import { redirect } from '@sveltejs/kit';

import { session } from '$lib/api/auth';
import { ApiError, NO_SERVER, deviceToken } from '$lib/api/client';
import { exertionScale } from '$lib/settings/exertion.svelte';
import { getStore } from '$lib/store/store';
import { syncNow } from '$lib/sync/client';
import { activeWorkout } from '$lib/workout/active.svelte';

import type { LayoutLoad } from './$types';

// The app itself: the client bundle ships to a Capacitor WebView, where there
// is no server. See CLAUDE.md hard rule 5.
//
// This lives here rather than on the root layout because the root now also
// carries the marketing page at `/`, which is the one route that is prerendered
// and server-rendered. Every app route belongs under this group; a route added
// outside it gets SvelteKit's defaults (`ssr = true`) and will not survive the
// APK build. `(auth)` is the third tree saying the same thing for itself.
export const ssr = false;
export const prerender = false;

/**
 * The gate, on the group rather than on each page — the client's echo of
 * `handle.ts`, where enforcement lives above the routes so a screen added later
 * is protected without its author having to remember. `/login` is outside this
 * layout, which is what stops the redirect from pointing at itself.
 *
 * There is nothing to gate when nobody has connected a server. PRODUCT.md makes
 * the server optional and the phone complete standalone, so `no server` is the
 * app's ordinary condition, not a locked door — and demanding a password to
 * reach data held on the device would be asking for a credential that protects
 * nothing and cannot be checked.
 *
 * Remaining debt, smaller than it was: with a server configured this still
 * blocks boot on a round-trip, so a phone whose server is merely unreachable
 * waits and then fails. The answer is the local store, which is what makes
 * "signed in" an answerable question offline.
 */
/**
 * The cold-start resume: a reload empties the holder while the snapshot in the
 * store survives, and everything reactive — the live dot, the tab bar standing
 * down, the workout screen's posture — reads the holder. Refilling it here,
 * above the routes, is what lets a boot onto any screen tell the truth about a
 * half-logged session; the workout page's own resume then only covers the
 * template editor's handoff. Awaited so no page renders against a holder this
 * is still about to fill, and guarded so an invalidation mid-session is a
 * no-op. Reading module state from a load leans on rule 5: with `ssr = false`
 * this only ever runs in the browser.
 */
async function restoreSession(): Promise<void> {
	if (activeWorkout.session !== null) {
		return;
	}

	const store = await getStore();
	const snapshot = await store.loadSnapshot();

	if (snapshot !== null) {
		activeWorkout.begin(await store.history(), snapshot);
	}
}

export const load: LayoutLoad = async ({ url, fetch }) => {
	// Both above the routes and for the same reason: the readers are everywhere
	// and none of them owns the fact. Awaited so no screen paints a rating in the
	// wrong language and then swaps it out from under the eye — it is one
	// indexed read of one record, on a connection the resume above just opened.
	await Promise.all([restoreSession(), exertionScale.load(await getStore())]);

	// The phone answers "signed in" from what it holds, before it asks the
	// network anything. A connected server with no token is the local-only state
	// a sign-out or a revocation leaves behind — ordinary, per PRODUCT.md, and
	// indistinguishable here from having no server at all. Skipping the call is
	// not just an optimisation: a boot on gym signal would otherwise wait out a
	// round-trip to be told what localStorage already knew.
	if (import.meta.env.APP_BUILD && deviceToken() === null) {
		return { user: null };
	}

	try {
		const { user } = await session(fetch);

		// The launch sync, fired and forgotten: the screen must not wait on the
		// network, and `syncNow` never throws. Push-after-write has its own
		// trigger where the writes happen.
		void syncNow(user.id);

		return { user };
	} catch (error) {
		// Not signed out — nowhere to be signed in to. The screens read `user`
		// as nullable and draw the local-only shape.
		if (error instanceof ApiError && error.status === NO_SERVER) {
			return { user: null };
		}

		if (error instanceof ApiError && error.status === 401) {
			// On the phone the credential is already gone — `request` drops a
			// Bearer the server just refused — so this is the cheap local-only
			// path above, one boot early. Never a redirect: the door out of
			// local-only is a row in Settings, not a wall in front of a workout.
			if (import.meta.env.APP_BUILD) {
				return { user: null };
			}

			// The whole attempted URL, so a deep link survives the detour. The
			// form validates it again on the way back out — this side is not
			// trusted to have written it, because anyone can send the link.
			const attempted = `${url.pathname}${url.search}`;
			redirect(307, `/login?redirectTo=${encodeURIComponent(attempted)}`);
		}

		// An unreachable or broken server is not "signed out", and answering it
		// with a login form would ask for a password that would not have helped.
		throw error;
	}
};
