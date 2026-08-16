import { sessionsByExercise } from '$lib/store/derive';
import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const store = await getStore();

	const [workouts, bodyweight] = await Promise.all([store.listWorkouts(), store.listBodyweight()]);

	return { workouts, sessions: sessionsByExercise(workouts), bodyweight };
};
