import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const store = await getStore();

	const [entries, range] = await Promise.all([store.listBodyweight(), store.weightRange()]);

	return { store, entries, range };
};
