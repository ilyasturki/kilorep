import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

/**
 * Everything the list needs in one read: the workouts, and the templates that
 * name them. Templates ride along whole rather than as a name map because the
 * store already holds them and the join is a screenful of rows, not a query.
 *
 * The store rides along for the writes a held row makes — the delete, and the
 * snapshot a repeat starts from.
 */
export const load: PageLoad = async () => {
	const store = await getStore();

	const [workouts, templates] = await Promise.all([store.listWorkouts(), store.listTemplates()]);

	return { store, workouts, templates };
};
