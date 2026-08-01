import { hintsOf } from '$lib/store/derive';
import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

/**
 * Everything the workout screen needs from the store, read once on the way
 * in: the last session of every exercise, and the snapshot to resume if an
 * earlier session never finished. The store itself rides along because the
 * page keeps writing to it — every mutation persists the snapshot, and FINISH
 * writes the record.
 *
 * The hint map is projected from those sessions rather than read separately:
 * the screen needs both — hints for the prefill, whole sessions for the insert
 * sheet's rows — and asking the store twice would walk every stored workout
 * again to reach the same answer.
 *
 * A `load` rather than an `onMount` so the screen never renders a frame
 * without its hints — the prefill the one-tap loop opens on is made of them.
 */
export const load: PageLoad = async () => {
	const store = await getStore();

	const [lastPerformed, resume] = await Promise.all([store.lastPerformed(), store.loadSnapshot()]);

	return { store, lastPerformed, history: hintsOf(lastPerformed), resume };
};
