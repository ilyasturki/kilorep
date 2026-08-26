import type { Equipment, Exercise, Muscle } from '$lib/domain/exercise';
import { searchExercises } from '$lib/domain/search';

export type PickerFilters = {
	query: string;
	muscle: Muscle | null;
	equipment: Equipment | null;
};

export function shownExercises(pool: Exercise[], filters: PickerFilters): Exercise[] {
	return searchExercises(pool, filters.query).filter(
		(exercise) =>
			(filters.muscle === null || exercise.muscles.primary === filters.muscle) &&
			(filters.equipment === null || exercise.equipment === filters.equipment)
	);
}

export function shownCaption(filters: PickerFilters): string {
	const parts = [filters.muscle, filters.equipment].filter((part) => part !== null);

	return parts.length === 0 ? 'All exercises' : parts.join(' · ');
}
