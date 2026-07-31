import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

/**
 * Everything the workout screen needs from the store, read once on the way
 * in: the hint map, and the snapshot to resume if an earlier session never
 * finished. The store itself rides along because the page keeps writing to it
 * — every mutation persists the snapshot, and FINISH writes the record.
 *
 * A `load` rather than an `onMount` so the screen never renders a frame
 * without its hints — the prefill the one-tap loop opens on is made of them.
 */
export const load: PageLoad = async () => {
	const store = await getStore();

	const [history, resume] = await Promise.all([store.history(), store.loadSnapshot()]);

	return { store, history, resume };
};
