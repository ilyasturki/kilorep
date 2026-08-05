import { sessionsByExercise } from '$lib/store/derive';
import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

/**
 * Everything the five cards read, in one pass: the workouts (Weekly work,
 * Training frequency and Sets per muscle walk them whole), the same workouts
 * folded into per-exercise sessions (Strength), and the body-weight log. All
 * local, like every read in the app — Progress asks the store, never a server.
 */
export const load: PageLoad = async () => {
	const store = await getStore();

	const [workouts, bodyweight] = await Promise.all([store.listWorkouts(), store.listBodyweight()]);

	return { workouts, sessions: sessionsByExercise(workouts), bodyweight };
};
