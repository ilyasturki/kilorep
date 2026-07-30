import { redirect } from '@sveltejs/kit';

import { session } from '$lib/api/auth';
import { ApiError, NO_SERVER } from '$lib/api/client';

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
export const load: LayoutLoad = async ({ url, fetch }) => {
	try {
		const { user } = await session(fetch);
		return { user };
	} catch (error) {
		// Not signed out — nowhere to be signed in to. The screens read `user`
		// as nullable and draw the local-only shape.
		if (error instanceof ApiError && error.status === NO_SERVER) {
			return { user: null };
		}

		if (error instanceof ApiError && error.status === 401) {
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
