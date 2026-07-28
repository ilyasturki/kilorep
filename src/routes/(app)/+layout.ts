import { redirect } from '@sveltejs/kit';

import { session } from '$lib/api/auth';
import { ApiError } from '$lib/api/client';

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
 * Known debt, and the reason it is written down rather than discovered: this
 * blocks app boot on a network round-trip, which is the opposite of what
 * PRODUCT.md promises. On the web surface that is fine — the origin serving the
 * page is the server, so it is reachable whenever the page is. On a phone with
 * no server connected it is wrong, and the answer is not a patch here but the
 * local store, which is what makes "signed in" an answerable question offline.
 * Deferred alongside the Capacitor shell.
 */
export const load: LayoutLoad = async ({ url, fetch }) => {
	try {
		const { user } = await session(fetch);
		return { user };
	} catch (error) {
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
