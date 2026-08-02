import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

/**
 * The whole log in one read, oldest first. All of it, like History: a decade
 * of daily weigh-ins is a few thousand rows, and the trend math wants the
 * pre-window tail anyway — the first visible average rests on days just
 * outside the chart. The store rides along for the writes the screen makes.
 */
export const load: PageLoad = async () => {
	const store = await getStore();

	return { store, entries: await store.listBodyweight() };
};
