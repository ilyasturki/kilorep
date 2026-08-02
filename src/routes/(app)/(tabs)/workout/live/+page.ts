import { redirect } from '@sveltejs/kit';

import { hintsOf } from '$lib/store/derive';
import { getStore } from '$lib/store/store';
import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';

import type { PageLoad } from './$types';

/**
 * Everything the loop needs from the store, read once on the way in: the last
 * session of every exercise, and the hint map projected from it. The store
 * itself rides along because the page keeps writing to it — every mutation
 * persists the snapshot, and FINISH writes the record.
 *
 * The hint map is projected from those sessions rather than read separately:
 * the screen needs both — hints for the prefill, whole sessions for the insert
 * sheet's rows — and asking the store twice would walk every stored workout
 * again to reach the same answer.
 *
 * A `load` rather than an `onMount` so the screen never renders a frame
 * without its hints — the prefill the one-tap loop opens on is made of them.
 *
 * The guard is the other half of `/workout`'s. This address *is* the session,
 * so standing on it without one is not a state to render but a wrong turn, and
 * the idle screen is where it goes. Both directions are stated, one on each
 * route, because a redirect running only one way would leave the other address
 * free to disagree with the holder — which is the failure the single
 * `/workout` was built to avoid, and the reason splitting it again is only
 * safe now that `(app)/+layout.ts` refills the holder before any page load
 * runs.
 *
 * Reading module state from a load leans on hard rule 5, exactly as that
 * layout's own resume does: with `ssr = false` this only ever runs in the
 * browser. And because that state is invisible to SvelteKit, `depends` is what
 * keeps the answer from being served out of a cache a hover-preload filled —
 * `SESSION_DEP` has the failure it costs.
 */
export const load: PageLoad = async ({ depends }) => {
	depends(SESSION_DEP);

	if (activeWorkout.session === null) {
		redirect(307, '/workout');
	}

	const store = await getStore();
	const lastPerformed = await store.lastPerformed();

	return { store, lastPerformed, history: hintsOf(lastPerformed) };
};
