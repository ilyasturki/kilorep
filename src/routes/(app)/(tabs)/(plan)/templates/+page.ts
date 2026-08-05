import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

/** The list this tab exists to show, read once on the way in. */
export const load: PageLoad = async () => {
	const store = await getStore();

	return { templates: await store.listTemplates() };
};
