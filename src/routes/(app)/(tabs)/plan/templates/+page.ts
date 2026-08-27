import { lastDoneByTemplate } from '$lib/domain/rotation';
import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const store = await getStore();

	// The ledger's TRAINED column and the rotation's own line are the same question asked
	// twice, so the history is read once here and reduced to the one record both want.
	const [templates, workouts] = await Promise.all([store.listTemplates(), store.listWorkouts()]);

	return { store, templates, lastDone: lastDoneByTemplate(workouts) };
};
