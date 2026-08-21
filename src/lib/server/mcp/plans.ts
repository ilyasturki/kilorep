import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';

import type { Template, TemplateMark } from '$lib/domain/template';
import { isArchived, isBlank, ranksFor, startable, templateRank } from '$lib/domain/template';
import { nextUp } from '$lib/domain/rotation';

import type { Tools } from './context.ts';
import { VERSION, failed, iso, refused, reply } from './format.ts';
import { nameOf, notInCatalogue, unknownIds } from './library.ts';
import type { PlannedInput } from './shapes.ts';
import { MARK, PLANNED_EXERCISE, flatRows, templateEntriesOf } from './shapes.ts';
import type { Expectation, WriteRequest } from './write.ts';

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
 * what trains next every time a plan was renamed. `order` moves only through reorder_plans.
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

const PLAN_IDS = z.array(z.string()).min(1).max(100);

export function registerPlans(server: McpServer, { library, write, writeAll }: Tools): void {
	const row = (template: Template, positions: Map<string, number>): Record<string, unknown> => {
		const lastDone = library.lastDone()[template.id];
		const archived = isArchived(template);

		// An archived plan is out of the rotation and nothing starts from it, so its tree is
		// weight without a question it answers — the name it lends old sessions is the whole
		// of what it still does. Unarchive it and the next read carries the exercises again.
		return {
			id: template.id,
			version: library.version(template.id),
			name: template.name,
			mark: template.mark ?? null,
			archived,
			lastTrained: lastDone === undefined ? null : iso(lastDone),
			position: archived ? undefined : (positions.get(template.id) ?? null),
			exercises: archived ? null : plannedRows(template)
		};
	};

	server.registerTool(
		'plans',
		{
			title: 'Plans',
			description:
				'Every plan in the rotation, in the order the lifter dragged them into, with what each prescribes and when it was last trained — plus the one the rotation says is next, which is simply the plan after the last one trained, wrapping at the end. Weight is never planned: a plan prescribes reps and the load is decided on the day. The `version` each row carries is what save_plan and delete_plan need; `position` is what reorder_plans takes back.',
			inputSchema: z.object({
				includeArchived: z
					.boolean()
					.default(false)
					.describe(
						'archived plans still name old sessions in History but never start one — they come back as name and version only, with `exercises: null`, and are worth asking for only to unarchive, rename or delete one'
					)
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
				'Create a plan, or change one that exists. Omit `id` to create; pass it with the `version` plans gave you to edit, and the write is refused if the plan has moved since. Anything you leave out is kept, but `exercises` replaces the whole tree, so send it back in full. Prescribe reps only — the load is the lifter’s call on the day. Renaming, re-marking and archiving happen here; a plan is one record, so several plans can be saved in parallel. Where a plan trains in the rotation is not set here — state the whole order through reorder_plans.',
			inputSchema: z.object({
				id: z.string().optional().describe('omit to create a new plan'),
				version: VERSION.optional().describe('required when editing, ignored when creating'),
				name: z.string().max(80).optional(),
				mark: MARK.nullable().optional().describe('null strips the badge'),
				exercises: z.array(PLANNED_EXERCISE).min(1).max(50).optional(),
				archived: z
					.boolean()
					.optional()
					.describe('archiving retires a plan without losing the name it lends old sessions')
			}),
			annotations: { idempotentHint: false }
		},
		({ id, version, name, mark, exercises, archived }) => {
			if (exercises !== undefined) {
				const unknown = unknownIds(exercises);

				if (unknown.length > 0) {
					return reply({ error: notInCatalogue(unknown) });
				}
			}

			const stored = id === undefined ? null : library.template(id);

			if (id !== undefined && stored === null) {
				return reply({ error: `no plan ${id}` });
			}

			if (stored !== null && version === undefined) {
				return reply({ error: 'editing a plan needs the `version` plans gave you' });
			}

			const now = Date.now();
			const planId = id ?? crypto.randomUUID();
			const next = merged(stored, planId, now, { name, mark, exercises, archived });

			if (isBlank(next)) {
				return reply({ error: 'a plan with no name and no exercises is never saved' });
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
		'reorder_plans',
		{
			title: 'Reorder the rotation',
			description:
				'State the rotation in full — every unarchived plan id, in the order they should train — and it is written as one change. This is the only way the order moves: save_plan cannot, because each single move shifts the positions of the plans around it and a second move aimed at a position read before the first is aimed at the wrong slot. No `version` is quoted here and none is needed; nothing but the order is touched, so a rename or a rewritten tree saved in the same breath survives it. Restating the order the rotation is already in changes nothing and is not an error.',
			inputSchema: z.object({
				orderedIds: PLAN_IDS.describe(
					'every unarchived plan id exactly once, first to train first — archived plans are not in the rotation and are refused here'
				)
			}),
			annotations: { idempotentHint: true }
		},
		({ orderedIds }) => {
			const rotation = startable(library.templates());
			const byId = new Map(rotation.map((template) => [template.id, template]));

			const seen = new Set(orderedIds);
			const repeated = orderedIds.filter((id, index) => orderedIds.indexOf(id) !== index);
			const unknown = orderedIds.filter((id) => !byId.has(id));

			if (repeated.length > 0) {
				return reply({ error: `named more than once: ${repeated.join(', ')}` });
			}

			if (unknown.length > 0) {
				return reply({
					error: `not plans in the rotation: ${unknown.join(', ')} — an archived or deleted plan has no place in it`
				});
			}

			const missing = rotation.filter((template) => !seen.has(template.id));

			if (missing.length > 0) {
				const named = missing.map((template) => `${template.id} (${template.name})`);

				return reply({
					error: `the rotation is stated in full or not at all — left out: ${named.join(', ')}`
				});
			}

			// oxlint-disable-next-line typescript/no-non-null-assertion
			const ordered = orderedIds.map((id) => byId.get(id)!);
			const ranks = ranksFor(ordered);

			const requests: WriteRequest[] = [];

			for (const [index, template] of ordered.entries()) {
				const rank = ranks[index];

				if (templateRank(template) === rank) {
					continue;
				}

				// Rebuilt through the same merge a save goes through, with nothing laid over it:
				// the rank is the only field this call has any business changing.
				const moved = merged(template, template.id, template.createdAt, {});

				moved.order = rank;

				requests.push({
					id: template.id,
					kind: 'template',
					payload: moved,
					// Read a heartbeat ago in this same request rather than quoted by the caller: the
					// guarantee is the same and the caller has one less stamp to keep straight.
					expect: library.version(template.id) ?? 'any'
				});
			}

			// The rotation as it will be read back, known before the write rather than after it:
			// `ordered` is the order asked for, and every plan in it now holds the rank that puts
			// it there. Re-reading would flush the memo and derive the whole history again to
			// learn what this call already decided.
			const next = nextUp(ordered, library.lastDone());
			const outcome = writeAll(requests);

			if (!outcome.ok) {
				return refused(outcome);
			}

			return reply({
				moved: requests.length,
				plans: ordered.map((template, index) => ({
					id: template.id,
					version: library.version(template.id),
					name: template.name,
					position: index
				})),
				nextUp: next === null ? null : { id: next.id, name: next.name }
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
