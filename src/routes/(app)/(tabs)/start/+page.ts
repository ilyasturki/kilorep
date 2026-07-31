import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

/**
 * One fact: is there a session to walk back into? The workout screen resumes
 * it either way — this only lets the button say so, because "Resume workout"
 * over a live session is information and a mislabelled "Start" is a small lie.
 */
export const load: PageLoad = async () => {
	const store = await getStore();

	return { resuming: (await store.loadSnapshot()) !== null };
};
