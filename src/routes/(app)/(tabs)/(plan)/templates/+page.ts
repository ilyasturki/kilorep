import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

/**
 * The list this tab exists to show, read once on the way in.
 *
 * The store rides along because the list is now writable: a drag stamps an
 * order on the template it moved and saves that one record, without the page
 * ever leaving this route.
 */
export const load: PageLoad = async () => {
	const store = await getStore();

	return { store, templates: await store.listTemplates() };
};
