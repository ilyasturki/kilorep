import type { Exercise } from './exercise.ts';
import { settleGrip } from './grip.ts';
import { MAX_PLANNED_SETS, plannedFrom, setSetCount } from './template.ts';
import type { Template, TemplateEntry, TemplateExercise } from './template.ts';
import { untouched } from './workout.ts';
import type { Workout, WorkoutExercise, WorkoutSet } from './workout.ts';

export type SetDrift = {
	added: number;
	removed: number;
	retargeted: number;
	/**
	 * The grip the exercise was actually worked with, when the plan asked for another.
	 *
	 * Only the exercise's own grip is read. A single set taken on a different handle is a fact
	 * about that set, not a change to carry back into the plan — the prompt would be offering
	 * to rewrite a Tuesday because of one drop set.
	 */
	grip: string | null;
	// The planned exerciseId this leg stood in for.
	instead: string | null;
};

export type Drift = {
	matched: Record<string, SetDrift>;
	unplanned: string[];
	missing: string[];
	reordered: boolean;
	regrouped: boolean;
};

type ExerciseOf = (exerciseId: string) => Exercise | undefined;

type Slotted = {
	slotOf: Map<string, TemplateExercise>;
	legsOf: Map<string, WorkoutExercise[]>;
};

function workingSets(exercise: WorkoutExercise): WorkoutSet[] {
	return exercise.sets.filter((set) => set.type !== 'warmup');
}

function slotting(workout: Workout, template: Template): Slotted {
	const slots = template.entries.flatMap((entry) => entry.exercises);
	const legs = workout.entries.flatMap((entry) => entry.exercises);

	const slotOf = new Map<string, TemplateExercise>();
	const legsOf = new Map<string, WorkoutExercise[]>();

	const take = (leg: WorkoutExercise, slot: TemplateExercise | undefined): void => {
		if (slot !== undefined) {
			slotOf.set(leg.id, slot);
			legsOf.set(slot.id, [...(legsOf.get(slot.id) ?? []), leg]);
		}
	};

	const free = (exerciseId: string): TemplateExercise | undefined =>
		slots.find((slot) => !legsOf.has(slot.id) && slot.exerciseId === exerciseId);

	// Planned legs first, so a stand-in dragged above the leg it replaced cannot take its slot.
	for (const leg of legs) {
		if (leg.plannedAs === undefined) {
			take(leg, free(leg.exerciseId));
		}
	}

	for (const leg of legs) {
		const planned = leg.plannedAs;

		if (planned === undefined) {
			continue;
		}

		// A slot its own exercise already holds: a swap that kept its logged sets, sharing the slot.
		take(
			leg,
			free(planned) ??
				slots.find((slot) => legsOf.has(slot.id) && slot.exerciseId === planned) ??
				free(leg.exerciseId)
		);
	}

	return { slotOf, legsOf };
}

const CLEAN: SetDrift = { added: 0, removed: 0, retargeted: 0, grip: null, instead: null };

function insteadOf(leg: WorkoutExercise, slot: TemplateExercise): string | null {
	return leg.exerciseId === slot.exerciseId ? null : slot.exerciseId;
}

function slotDrift(
	slot: TemplateExercise,
	legs: WorkoutExercise[],
	exerciseOf: ExerciseOf
): SetDrift {
	if (legs.every((leg) => untouched(leg))) {
		return CLEAN;
	}

	const working = legs.flatMap((leg) => workingSets(leg));
	const shared = Math.min(working.length, slot.sets.length);

	const retargeted = working
		.slice(0, shared)
		.filter((set, i) => set.plannedReps !== slot.sets[i].plannedReps).length;

	const own = legs.find((leg) => leg.exerciseId === slot.exerciseId);
	const meta = exerciseOf(slot.exerciseId);
	const grip = own === undefined ? undefined : settleGrip(meta, own.grip);

	return {
		added: Math.max(0, working.length - slot.sets.length),
		removed: Math.max(0, slot.sets.length - working.length),
		retargeted,
		grip: grip === undefined || grip === settleGrip(meta, slot.grip) ? null : grip,
		instead: null
	};
}

function lifted(leg: WorkoutExercise): boolean {
	return workingSets(leg).some((set) => set.completed);
}

type Piece = { slot: TemplateExercise } | { leg: WorkoutExercise };

type Group = { source: TemplateEntry | null; pieces: Piece[] };

// Reuses the plan's own objects, so their ids and any keys a newer build added survive.
function reshaped(template: Template, workout: Workout, slotted: Slotted): Group[] {
	const homeOf = new Map<string, TemplateEntry>();

	for (const entry of template.entries) {
		for (const exercise of entry.exercises) {
			homeOf.set(exercise.id, entry);
		}
	}

	const placed = new Set<string>();
	const used = new Set<TemplateEntry>();
	const groups: Group[] = [];

	const claim = (home: TemplateEntry | undefined): TemplateEntry | null => {
		if (home === undefined || used.has(home)) {
			return null;
		}

		used.add(home);

		return home;
	};

	for (const entry of workout.entries) {
		const pieces: Piece[] = [];

		for (const leg of entry.exercises) {
			const slot = slotted.slotOf.get(leg.id);

			if (slot === undefined) {
				if (lifted(leg)) {
					pieces.push({ leg });
				}
			} else if (!placed.has(slot.id)) {
				placed.add(slot.id);
				pieces.push({ slot });
			}
		}

		if (pieces.length === 0) {
			continue;
		}

		const homes = pieces.map((piece) => ('slot' in piece ? homeOf.get(piece.slot.id) : undefined));
		const source = homes.find((home) => home !== undefined && !used.has(home));

		groups.push({ source: claim(source), pieces });
	}

	const flat = template.entries.flatMap((entry) => entry.exercises);

	for (const [index, slot] of flat.entries()) {
		if (placed.has(slot.id) || slot.optional !== true) {
			continue;
		}

		const home = homeOf.get(slot.id);
		const holding = groups.find((group) => group.source !== null && group.source === home);

		placed.add(slot.id);

		if (holding !== undefined) {
			const next = holding.pieces.findIndex(
				(piece) => 'slot' in piece && flat.indexOf(piece.slot) > index
			);

			holding.pieces.splice(next === -1 ? holding.pieces.length : next, 0, { slot });

			continue;
		}

		const before = flat.slice(0, index).findLast((earlier) => placed.has(earlier.id));

		const at =
			before === undefined
				? -1
				: groups.findIndex((group) =>
						group.pieces.some((piece) => 'slot' in piece && piece.slot.id === before.id)
					);

		groups.splice(at + 1, 0, { source: claim(home), pieces: [{ slot }] });
	}

	return groups;
}

function slotIds(pieces: Piece[]): string[] {
	return pieces.flatMap((piece) => ('slot' in piece ? [piece.slot.id] : []));
}

function partition(groups: string[][]): string {
	return groups
		.filter((ids) => ids.length > 0)
		.map((ids) => ids.toSorted().join('+'))
		.toSorted()
		.join(' ');
}

function moves(template: Template, groups: Group[]): { reordered: boolean; regrouped: boolean } {
	const kept = new Set(groups.flatMap((group) => slotIds(group.pieces)));

	const before = template.entries.map((entry) =>
		entry.exercises.filter((exercise) => kept.has(exercise.id)).map((exercise) => exercise.id)
	);
	const after = groups.map((group) => slotIds(group.pieces));

	return {
		reordered: before.flat().join(' ') !== after.flat().join(' '),
		regrouped: partition(before) !== partition(after)
	};
}

export function driftFrom(workout: Workout, template: Template, exerciseOf: ExerciseOf): Drift {
	const slotted = slotting(workout, template);

	const matched: Record<string, SetDrift> = {};
	const unplanned: string[] = [];

	for (const entry of workout.entries) {
		for (const leg of entry.exercises) {
			const slot = slotted.slotOf.get(leg.id);

			if (slot === undefined) {
				unplanned.push(leg.id);

				continue;
			}

			const legs = slotted.legsOf.get(slot.id) ?? [leg];
			const counted = legs[0] === leg ? slotDrift(slot, legs, exerciseOf) : CLEAN;

			matched[leg.id] = {
				added: counted.added,
				removed: counted.removed,
				retargeted: counted.retargeted,
				grip: counted.grip,
				instead: insteadOf(leg, slot)
			};
		}
	}

	const missing = template.entries
		.flatMap((entry) => entry.exercises)
		.filter((slot) => !slotted.legsOf.has(slot.id) && slot.optional !== true)
		.map((slot) => slot.exerciseId);

	const { reordered, regrouped } = moves(template, reshaped(template, workout, slotted));

	return { matched, unplanned, missing, reordered, regrouped };
}

export function hasSetDrift(drift: SetDrift): boolean {
	return (
		drift.added > 0 ||
		drift.removed > 0 ||
		drift.retargeted > 0 ||
		drift.grip !== null ||
		drift.instead !== null
	);
}

export function hasDrift(drift: Drift): boolean {
	return (
		drift.unplanned.length > 0 ||
		drift.missing.length > 0 ||
		drift.reordered ||
		drift.regrouped ||
		Object.values(drift.matched).some((setDrift) => hasSetDrift(setDrift))
	);
}

export type PlanChange =
	| { kind: 'sets'; exerciseId: string; from: number; to: number }
	| { kind: 'grip'; exerciseId: string; grip: string }
	| { kind: 'added'; exerciseId: string }
	| { kind: 'removed'; exerciseId: string }
	| { kind: 'order' }
	| { kind: 'supersets' };

// Made only when `applyDrift` is handed its `legId`.
export type PlanSwap = { legId: string; from: string; to: string };

export type PlanOffer = { changes: PlanChange[]; swaps: PlanSwap[] };

function plannedCount(legs: WorkoutExercise[]): number {
	return Math.min(
		MAX_PLANNED_SETS,
		legs.reduce((count, leg) => count + workingSets(leg).length, 0)
	);
}

export function planOffer(template: Template, workout: Workout, exerciseOf: ExerciseOf): PlanOffer {
	const slotted = slotting(workout, template);
	const changes: PlanChange[] = [];
	const swaps: PlanSwap[] = [];

	for (const entry of workout.entries) {
		for (const leg of entry.exercises) {
			const slot = slotted.slotOf.get(leg.id);

			if (slot === undefined) {
				if (lifted(leg)) {
					changes.push({ kind: 'added', exerciseId: leg.exerciseId });
				}

				continue;
			}

			const legs = slotted.legsOf.get(slot.id) ?? [leg];

			if (legs[0] !== leg || legs.every((one) => untouched(one))) {
				continue;
			}

			const own = legs.find((one) => one.exerciseId === slot.exerciseId);

			if (own === undefined) {
				swaps.push({ legId: leg.id, from: slot.exerciseId, to: leg.exerciseId });

				continue;
			}

			const { grip } = slotDrift(slot, legs, exerciseOf);

			if (grip !== null) {
				changes.push({ kind: 'grip', exerciseId: slot.exerciseId, grip });
			}

			const count = plannedCount(legs);

			if (count > 0 && count !== slot.sets.length) {
				changes.push({
					kind: 'sets',
					exerciseId: slot.exerciseId,
					from: slot.sets.length,
					to: count
				});
			}
		}
	}

	for (const slot of template.entries.flatMap((entry) => entry.exercises)) {
		if (!slotted.legsOf.has(slot.id) && slot.optional !== true) {
			changes.push({ kind: 'removed', exerciseId: slot.exerciseId });
		}
	}

	const { reordered, regrouped } = moves(template, reshaped(template, workout, slotted));

	if (reordered) {
		changes.push({ kind: 'order' });
	}

	if (regrouped) {
		changes.push({ kind: 'supersets' });
	}

	return { changes, swaps };
}

export function applyDrift(
	template: Template,
	workout: Workout,
	exerciseOf: ExerciseOf,
	mint: () => string,
	swaps: string[] = []
): void {
	const slotted = slotting(workout, template);

	for (const legs of slotted.legsOf.values()) {
		const slot = slotted.slotOf.get(legs[0].id);

		if (slot === undefined || legs.every((leg) => untouched(leg))) {
			continue;
		}

		const own = legs.find((leg) => leg.exerciseId === slot.exerciseId);

		if (own === undefined) {
			const standIn = legs[0];

			if (!swaps.includes(standIn.id)) {
				continue;
			}

			slot.exerciseId = standIn.exerciseId;

			const grip =
				standIn.grip === undefined
					? undefined
					: settleGrip(exerciseOf(standIn.exerciseId), standIn.grip);

			if (grip === undefined) {
				delete slot.grip;
			} else {
				slot.grip = grip;
			}
		} else {
			const { grip } = slotDrift(slot, legs, exerciseOf);

			if (grip !== null) {
				slot.grip = grip;
			}
		}

		const count = plannedCount(legs);

		if (count > 0) {
			setSetCount(template, slot.id, count, mint);
		}
	}

	template.entries = reshaped(template, workout, slotted).map((group) => {
		const exercises = group.pieces
			.map((piece) => ('slot' in piece ? piece.slot : plannedFrom(piece.leg, mint)))
			.filter((exercise) => exercise !== null);

		if (group.source === null) {
			return { id: mint(), exercises };
		}

		group.source.exercises = exercises;

		return group.source;
	});
}
