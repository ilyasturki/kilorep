import { sessionsByExercise } from '$lib/store/derive';
import { getStore } from '$lib/store/store';
import { RECORDS_DEP } from '$lib/sync/client';

import type { PageLoad } from './$types';

export const load: PageLoad = async ({ depends }) => {
	depends(RECORDS_DEP);

	const store = await getStore();

	const [workouts, bodyweight, { byId }] = await Promise.all([
		store.listWorkouts(),
		store.listBodyweight(),
		store.catalog()
	]);

	return { workouts, sessions: sessionsByExercise(workouts, byId), bodyweight };
};
