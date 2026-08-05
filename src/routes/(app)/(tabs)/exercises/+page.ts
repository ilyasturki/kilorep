import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

/**
 * The last session of every exercise, read once on the way in — the rows spell
 * it under each name, and a list that rendered a frame without it would flash
 * every exercise as never-performed before correcting itself.
 *
 * A `load` rather than an `onMount` for that reason alone; the screen writes
 * nothing, so the store itself does not ride along the way the workout page's
 * does.
 */
export const load: PageLoad = async () => {
	const store = await getStore();

	return { lastPerformed: await store.lastPerformed() };
};
