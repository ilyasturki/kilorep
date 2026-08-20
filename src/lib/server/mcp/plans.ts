import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';

import type { Template, TemplateMark } from '$lib/domain/template';
import { isArchived, isBlank, reorder, startable } from '$lib/domain/template';
import { nextUp } from '$lib/domain/rotation';

import type { Tools } from './context.ts';
import { VERSION, failed, iso, refused, reply } from './format.ts';
import { nameOf, unknownIds } from './library.ts';
import type { PlannedInput } from './shapes.ts';
import { MARK, PLANNED_EXERCISE, flatRows, templateEntriesOf } from './shapes.ts';
import type { Expectation } from './write.ts';

/** The planned tree, flattened into the shape save_plan takes back. */
function plannedRows(template: Template): Record<string, unknown>[] {
	return flatRows(template.entries, (exercise) => ({
		exerciseId: exercise.exerciseId,
		name: nameOf(exercise.exerciseId),
		sets: exercise.sets.map((set) => set.plannedReps)
	}));
}

type Edit = {
	name?: string | undefined;
	mark?: TemplateMark | null | undefined;
	exercises?: PlannedInput[] | undefined;
	archived?: boolean | undefined;
};

/**
 * The stored plan with the edit laid over it.
 *
 * What the schema does not model, the stored record keeps: `createdAt` and `order` decide
 * where the plan sits in the rotation, and a save that let a caller restate them would move
 * what trains next every time a plan was renamed. `order` moves only through `position`.
 */
function merged(stored: Template | null, id: string, now: number, edit: Edit): Template {
	const next: Template = {
		id,
		name: '',
		createdAt: now,
		entries: []
	};

	if (stored !== null) {
		next.name = stored.name;
		next.createdAt = stored.createdAt;
		next.entries = stored.entries;

		if (stored.mark !== undefined) {
			next.mark = stored.mark;
		}

		if (stored.order !== undefined) {
			next.order = stored.order;
		}

		if (stored.archivedAt !== undefined) {
			next.archivedAt = stored.archivedAt;
		}
	}

	if (edit.name !== undefined) {
		next.name = edit.name;
	}

	if (edit.mark !== undefined) {
		next.mark = edit.mark;
	}

	if (edit.exercises !== undefined) {
		next.entries = templateEntriesOf(edit.exercises);
	}

	if (edit.archived !== undefined) {
		next.archivedAt = edit.archived ? now : null;
	}

	return next;
}

export function registerPlans(server: McpServer, { library, write }: Tools): void {
	const row = (template: Template, positions: Map<string, number>): Record<string, unknown> => {
		const lastDone = library.lastDone()[template.id];

		return {
			id: template.id,
			version: library.version(template.id),
			name: template.name,
			mark: template.mark ?? null,
			archived: isArchived(template),
			position: positions.get(template.id) ?? null,
			lastTrained: lastDone === undefined ? null : iso(lastDone),
			exercises: plannedRows(template)
		};
	};

	server.registerTool(
		'plans',
		{
			title: 'Plans',
			description:
				'Every plan, in the order the lifter dragged them into, with what each prescribes and when it was last trained — plus the one the rotation says is next, which is simply the plan after the last one trained, wrapping at the end. Weight is never planned: a plan prescribes reps and the load is decided on the day. The `version` each row carries is what save_plan and delete_plan need.',
			inputSchema: z.object({
				includeArchived: z
					.boolean()
					.default(false)
					.describe('archived plans still name old sessions in History but never start one')
			}),
			annotations: { readOnlyHint: true }
		},
		({ includeArchived }) => {
			const templates = library.templates();
			const active = startable(templates);
			const positions = new Map(active.map((template, index) => [template.id, index]));
			const shown = includeArchived ? templates : active;
			const next = nextUp(active, library.lastDone());

			return reply({
				plans: shown.map((template) => row(template, positions)),
				nextUp: next === null ? null : { id: next.id, name: next.name },
				archived: templates.length - active.length
			});
		}
	);

	server.registerTool(
		'save_plan',
		{
			title: 'Write a plan',
			description:
				'Create a plan, or change one that exists. Omit `id` to create; pass it with the `version` plans gave you to edit, and the write is refused if the plan has moved since. Anything you leave out is kept, but `exercises` replaces the whole tree, so send it back in full. Prescribe reps only — the load is the lifter’s call on the day. Renaming, re-marking, archiving and reordering all happen here.',
			inputSchema: z.object({
				id: z.string().optional().describe('omit to create a new plan'),
				version: VERSION.optional().describe('required when editing, ignored when creating'),
				name: z.string().max(80).optional(),
				mark: MARK.nullable().optional().describe('null strips the badge'),
				exercises: z.array(PLANNED_EXERCISE).min(1).max(50).optional(),
				archived: z
					.boolean()
					.optional()
					.describe('archiving retires a plan without losing the name it lends old sessions'),
				position: z
					.number()
					.int()
					.min(0)
					.optional()
					.describe(
						'move it in the rotation — 0 trains first. This changes what comes up next, so only pass it when the lifter asked to reorder.'
					)
			}),
			annotations: { idempotentHint: false }
		},
		({ id, version, name, mark, exercises, archived, position }) => {
			if (exercises !== undefined) {
				const unknown = unknownIds(exercises);

				if (unknown.length > 0) {
					return reply({ error: `not in the catalogue: ${unknown.join(', ')}` });
				}
			}

			const stored = id === undefined ? null : library.template(id);

			if (id !== undefined && stored === null) {
				return reply({ error: `no plan ${id}` });
			}

			if (stored !== null && version === undefined) {
				return reply({ error: 'editing a plan needs the `version` plans gave you' });
			}

			if (stored === null && position !== undefined) {
				return reply({
					error: 'a new plan lands at the end of the rotation — move it with a second save_plan'
				});
			}

			const now = Date.now();
			const planId = id ?? crypto.randomUUID();
			const next = merged(stored, planId, now, { name, mark, exercises, archived });

			if (isBlank(next)) {
				return reply({ error: 'a plan with no name and no exercises is never saved' });
			}

			if (position !== undefined) {
				// The rotation as this save leaves it, not as it was read: unarchiving in the same
				// call puts the plan back in it, and reordering against the stored list would refuse
				// the move the caller had just made possible.
				const rotation = startable(
					library.templates().map((template) => (template.id === planId ? next : template))
				);
				const moved = reorder(rotation, planId, position);

				if (moved === null) {
					return reply({
						error: `position ${position} does not move this plan — it is archived, already there, or past the end`
					});
				}

				next.order = moved;
			}

			// Creating states that nothing is there; editing states the version it read.
			let expect: Expectation = 'absent';

			if (stored !== null && version !== undefined) {
				expect = version;
			}

			const outcome = write({
				id: planId,
				kind: 'template',
				payload: next,
				expect
			});

			if (failed(outcome)) {
				return refused(outcome);
			}

			return reply({
				id: planId,
				version: outcome.updatedAt,
				name: next.name,
				archived: isArchived(next),
				exercises: plannedRows(next)
			});
		}
	);

	server.registerTool(
		'delete_plan',
		{
			title: 'Delete a plan',
			description:
				'Remove a plan for good. Sessions trained from it keep their sets but lose the name they were resolving through it, and the rotation closes over the gap. Archiving says the same thing without the loss, so prefer it unless the lifter meant delete. Pass the `version` plans gave you.',
			inputSchema: z.object({
				id: z.string(),
				version: VERSION
			}),
			annotations: { destructiveHint: true, idempotentHint: true }
		},
		({ id, version }) => {
			const stored = library.template(id);

			if (stored === null) {
				return reply({ error: `no plan ${id}` });
			}

			const trained = library.workouts().filter((workout) => workout.templateId === id).length;

			const outcome = write({
				id,
				kind: 'template',
				payload: stored,
				expect: version,
				deleted: true
			});

			if (failed(outcome)) {
				return refused(outcome);
			}

			return reply({ deleted: { id, name: stored.name }, sessionsLeftUnnamed: trained });
		}
	);
}
