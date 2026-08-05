import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

/**
 * The whole log in one read, oldest first. All of it, like History: a decade
 * of daily weigh-ins is a few thousand rows, and the trend math wants the
 * pre-window tail anyway — the first visible average rests on days just
 * outside the chart. The store rides along for the writes the screen makes.
 *
 * The remembered range comes with it rather than through the `(app)` layout,
 * where the exertion scale and the rest settings are loaded: those two are read
 * by screens all over the app, and this one is read by this page alone. A
 * preference nobody else asks about has no business on the boot path.
 */
export const load: PageLoad = async () => {
	const store = await getStore();

	const [entries, range] = await Promise.all([store.listBodyweight(), store.weightRange()]);

	return { store, entries, range };
};
