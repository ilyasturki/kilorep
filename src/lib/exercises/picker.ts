import type { Equipment, Exercise, Muscle } from '$lib/domain/exercise';
import { settleGrip } from '$lib/domain/grip';
import { normalize, searchExercises } from '$lib/domain/search';
import { GRIP_ALIASES } from '$lib/exercises/aliases';
import { sections } from '$lib/exercises/browse';
import type { Family } from '$lib/exercises/browse';

export type PickerFilters = {
	query: string;
	muscle: Muscle | null;
	equipment: Equipment | null;
};

export type Pick = { exerciseId: string; grip?: string };

export function shownExercises(pool: Exercise[], filters: PickerFilters): Exercise[] {
	return searchExercises(pool, filters.query).filter(
		(exercise) =>
			(filters.muscle === null || exercise.muscles.primary === filters.muscle) &&
			(filters.equipment === null || exercise.equipment === filters.equipment)
	);
}

export type PickerGroup = { caption: string; families: Family[] };

export function pickerGroups(
	pool: Exercise[],
	filters: PickerFilters,
	shelved: Exercise[] = []
): PickerGroup[] {
	const skip = new Set(shelved.map((exercise) => exercise.id));
	const shown = shownExercises(pool, filters).filter((exercise) => !skip.has(exercise.id));

	if (normalize(filters.query) !== '') {
		return [
			{ caption: 'All matches', families: shown.map((parent) => ({ parent, variants: [] })) }
		];
	}

	return sections(shown).map((section) => ({
		caption: section.muscle,
		families: section.families
	}));
}

// A query the exercise's own name answers names no grip: "pull up" is every pull-up.
export function gripNamed(exercise: Exercise, query: string): string | undefined {
	const named = GRIP_ALIASES[exercise.id];
	const tokens = normalize(query)
		.split(' ')
		.filter((token) => token !== '');

	if (named === undefined || tokens.length === 0) {
		return undefined;
	}

	const covers = (text: string): boolean => tokens.every((token) => text.includes(token));

	if (covers(normalize(exercise.name))) {
		return undefined;
	}

	const lookup = new Map(Object.entries(named).map(([alias, grip]) => [normalize(alias), grip]));
	const grips = new Set(
		exercise.aliases
			.map((alias) => normalize(alias))
			.filter((alias) => covers(alias))
			.map((alias) => lookup.get(alias))
	);

	if (grips.size !== 1) {
		return undefined;
	}

	const [grip] = grips;

	return grip === undefined ? undefined : settleGrip(exercise, grip);
}

export function pickOf(exercise: Exercise, query: string): Pick {
	const grip = gripNamed(exercise, query);

	return grip === undefined ? { exerciseId: exercise.id } : { exerciseId: exercise.id, grip };
}
