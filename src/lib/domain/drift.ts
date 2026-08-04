import type { Template, TemplateExercise } from './template.ts';
import type { Workout, WorkoutExercise, WorkoutSet } from './workout.ts';

export type SetDrift = {
	added: number;
	removed: number;
	retargeted: number;
};

export type Drift = {
	matched: Record<string, SetDrift>;
	unplanned: string[];
	missing: string[];
};

function workingSets(exercise: WorkoutExercise): WorkoutSet[] {
	return exercise.sets.filter((set) => set.type !== 'warmup');
}

function setDriftOf(performed: WorkoutExercise, planned: TemplateExercise): SetDrift {
	const working = workingSets(performed);
	const shared = Math.min(working.length, planned.sets.length);

	const retargeted = working
		.slice(0, shared)
		.filter((set, i) => set.plannedReps !== planned.sets[i].plannedReps).length;

	return {
		added: Math.max(0, working.length - planned.sets.length),
		removed: Math.max(0, planned.sets.length - working.length),
		retargeted
	};
}

export function driftFrom(workout: Workout, template: Template): Drift {
	const slots = template.entries.flatMap((entry) => entry.exercises);
	const taken = new Set<string>();

	const matched: Record<string, SetDrift> = {};
	const unplanned: string[] = [];

	for (const entry of workout.entries) {
		for (const performed of entry.exercises) {
			const slot = slots.find(
				(candidate) => !taken.has(candidate.id) && candidate.exerciseId === performed.exerciseId
			);

			if (slot === undefined) {
				unplanned.push(performed.id);
			} else {
				taken.add(slot.id);
				matched[performed.id] = setDriftOf(performed, slot);
			}
		}
	}

	const missing = slots.filter((slot) => !taken.has(slot.id)).map((slot) => slot.exerciseId);

	return { matched, unplanned, missing };
}

export function hasSetDrift(drift: SetDrift): boolean {
	return drift.added > 0 || drift.removed > 0 || drift.retargeted > 0;
}

export function hasDrift(drift: Drift): boolean {
	return (
		drift.unplanned.length > 0 ||
		drift.missing.length > 0 ||
		Object.values(drift.matched).some((setDrift) => hasSetDrift(setDrift))
	);
}
