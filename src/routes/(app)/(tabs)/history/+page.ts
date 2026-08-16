import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const store = await getStore();

	const [workouts, templates] = await Promise.all([store.listWorkouts(), store.listTemplates()]);

	return { store, workouts, templates };
};
