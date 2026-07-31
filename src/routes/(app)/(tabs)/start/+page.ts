import { redirect } from '@sveltejs/kit';

import { getStore } from '$lib/store/store';
import { activeWorkout } from '$lib/workout/active.svelte';

import type { PageLoad } from './$types';

/**
 * While a session is live, Start's destination is the workout — the bars
 * already say so by wearing Workout in this tab's slot, and this reroute is
 * what keeps that claim honest for a deep link or a back button that lands
 * here anyway. FINISH empties the holder before navigating, so arriving from
 * it finds nothing to bounce off. Reading module state from a load leans on
 * rule 5: with `ssr = false` this only ever runs in the browser, where the
 * holder is the same one the bars and the workout screen share.
 *
 * Past the reroute, two facts: the template list this screen exists to show,
 * and whether there is a snapshot to walk back into. The snapshot is the
 * reload case — the holder is memory and died with the page, the snapshot did
 * not. The workout screen resumes it either way; this only lets the button
 * say so, because "Resume workout" over a survived session is information and
 * a mislabelled "Start" is a small lie.
 */
export const load: PageLoad = async () => {
	if (activeWorkout.session !== null) {
		redirect(307, '/workout');
	}

	const store = await getStore();

	const [templates, snapshot] = await Promise.all([store.listTemplates(), store.loadSnapshot()]);

	return { templates, resuming: snapshot !== null };
};
