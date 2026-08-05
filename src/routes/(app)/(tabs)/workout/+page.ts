import { redirect } from '@sveltejs/kit';

import { hintsOf } from '$lib/store/derive';
import { getStore } from '$lib/store/store';
import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';

import type { PageLoad } from './$types';

/**
 * The idle screen's read, and the gate in front of it.
 *
 * Templates for the list of ways to begin — same order and cap-free read as the
 * Templates tab; the screen decides how many to show. Workouts for the other
 * list of ways to begin, and read cap-free for the same reason: the store holds
 * the whole history in memory already, so the cap is a rendering decision rather
 * than a query. The hint map because starting is what this screen does, and a
 * session is constructed with one. The store because both start paths hand it to
 * `WorkoutSession` and the next screen writes through it — and because a held
 * row deletes through it.
 *
 * Nothing here starts a workout by being looked at. What it does do is pick up
 * a start someone else has already made: the template editor and History's
 * repeat both write a snapshot, empty the holder and navigate here, so a
 * snapshot found on arrival is a handoff and this is where it is claimed.
 *
 * That claim cannot be left to `(app)/+layout.ts`'s cold-start resume, which
 * looks like it would cover it. That load reads neither `url` nor `params` on
 * its happy path, so SvelteKit has nothing to invalidate it against and it runs
 * once per boot — never again on a client-side navigation, which is exactly
 * what a handoff is. The page load below re-runs on every arrival, which is why
 * the pickup belongs here.
 *
 * And once the holder is full, this address has nothing to say: the session is
 * at `/workout/live`, whose own load states the opposite half of the same rule.
 *
 * `depends` is what stops that rule from being answered out of a cache. The
 * holder is invisible to SvelteKit, and `app.html` preloads on hover — so this
 * load runs speculatively as the pointer crosses the Workout tab, and the
 * redirect it produced while a session was live was still being handed out
 * after FINISH had ended one. `SESSION_DEP` carries the rest.
 */
export const load: PageLoad = async ({ depends }) => {
	depends(SESSION_DEP);

	const store = await getStore();

	const [lastPerformed, resume, templates, workouts] = await Promise.all([
		store.lastPerformed(),
		store.loadSnapshot(),
		store.listTemplates(),
		store.listWorkouts()
	]);

	const history = hintsOf(lastPerformed);

	if (activeWorkout.session === null && resume !== null) {
		activeWorkout.begin(history, resume);
	}

	if (activeWorkout.session !== null) {
		redirect(307, '/workout/live');
	}

	return { store, history, templates, workouts };
};
