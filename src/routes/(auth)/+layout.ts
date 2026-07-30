import { redirect } from '@sveltejs/kit';

import { googleEnabled, session } from '$lib/api/auth';
import { resolveRedirect } from '$lib/api/redirect';

import type { LayoutLoad } from './$types';

// The third tree that has to say this for itself, alongside `(app)` and `dev`.
// There is no global net: a route outside all three gets SvelteKit's default
// `ssr = true`, which compiles into the Capacitor bundle and breaks it quietly.
// See CLAUDE.md hard rule 5, which names the first two.
export const ssr = false;
export const prerender = false;

/**
 * Sign-in is not a place for someone who is already signed in, so this bounces
 * them straight to where they were going.
 *
 * It honours `redirectTo` for the same reason the form does: arriving here with
 * a session and a destination in hand means a deep link was followed by someone
 * whose cookie was still good, and dropping the destination would strand them
 * on Start for no reason.
 *
 * Anything other than a clean session renders the form. A 401 is the ordinary
 * case; an unreachable server is not, but the answer is the same — a login form
 * is exactly what someone whose server just came back will want, and refusing
 * to draw one because the server is down is a screen with no way out.
 *
 * `google` comes back with it because the screen cannot draw itself without
 * knowing: an instance with no client configured must not offer a button that
 * leads nowhere. Asked here rather than in the page so it is one request
 * alongside the session one, and so the page has the answer before its first
 * paint rather than growing a button a moment later.
 */
export const load: LayoutLoad = async ({ url, fetch }) => {
	// Started before the session is awaited, not after it: the two ask different
	// endpoints and neither reads the other's answer, so awaiting them in turn
	// would put two round-trips in front of the first paint of the one screen a
	// signed-out visitor ever sees. `googleEnabled` answers false rather than
	// throwing, so nothing is left unhandled when the redirect below fires past
	// this promise.
	const google = googleEnabled(fetch);

	let signedIn = false;
	try {
		await session(fetch);
		signedIn = true;
	} catch {
		signedIn = false;
	}

	// Outside the `try`, because `redirect` reports itself by throwing and a
	// catch around it would swallow the redirect and render the form instead.
	if (signedIn) {
		redirect(307, resolveRedirect(url.searchParams.get('redirectTo'), url.origin));
	}

	return { google: await google };
};
