import type { Cookies } from '@sveltejs/kit';

import { GOOGLE_BASE } from '../../api/routes.ts';
import { isRecord } from '../json.ts';
import { secureCookies } from './session.ts';

/**
 * Where a sign-in in progress is kept between `start` and `callback`, which is
 * the only thing either route remembers about it.
 *
 * A cookie rather than server memory. `adapter-node` is one process today, so a
 * map would work — right up until an instance restarts mid-sign-in, and then it
 * fails for one person, once, in a way nobody can reproduce. Nothing identifying
 * is in here: a random string to compare, the PKCE verifier, and where the
 * person was going.
 */

export const HANDSHAKE_COOKIE = 'kr_oauth';

/**
 * Scoped to the two routes that use it, so it rides on those requests rather
 * than every one. The callback lives under this path, which is what makes the
 * narrow scope possible.
 */
const COOKIE_PATH = GOOGLE_BASE;

/**
 * Long enough to read a consent screen and pick an account, short enough that a
 * handshake abandoned in a tab is not still good tomorrow.
 */
const MAX_AGE_SECONDS = 10 * 60;

export type Handshake = { state: string; verifier: string; redirectTo: string };

/**
 * `sameSite: 'lax'` is load-bearing rather than copied: the callback arrives as
 * a top-level navigation from accounts.google.com, which is cross-site, and
 * `strict` would withhold the cookie on exactly the one request that needs it.
 * The failure would surface as a state mismatch — an error pointing at the wrong
 * thing entirely.
 *
 * `secure` comes from `secureCookies` rather than being re-derived here, for the
 * reason written where it lives: a `Secure` cookie sent over plain http is
 * dropped without a word, and the LAN self-hoster would get a sign-in that
 * always fails and never says why.
 */
export function setHandshake(cookies: Cookies, url: URL, handshake: Handshake): void {
	cookies.set(HANDSHAKE_COOKIE, JSON.stringify(handshake), {
		path: COOKIE_PATH,
		httpOnly: true,
		sameSite: 'lax',
		secure: secureCookies(url),
		maxAge: MAX_AGE_SECONDS
	});
}

/**
 * Reads the handshake and clears it in the same breath: an authorization code
 * may be spent once, so the state authorising the spend lives exactly as long.
 * Deleted even when it parses to nothing, so a corrupt cookie cannot wedge every
 * later attempt.
 */
export function takeHandshake(cookies: Cookies, url: URL): Handshake | undefined {
	const raw = cookies.get(HANDSHAKE_COOKIE);
	cookies.delete(HANDSHAKE_COOKIE, { path: COOKIE_PATH, secure: secureCookies(url) });

	if (raw === undefined) {
		return undefined;
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return undefined;
	}

	if (!isRecord(parsed)) {
		return undefined;
	}

	// A missing key destructures to `undefined`, which is not a string — so the
	// one check below covers both "absent" and "wrong type".
	const { state, verifier, redirectTo } = parsed;
	if (typeof state !== 'string' || typeof verifier !== 'string' || typeof redirectTo !== 'string') {
		return undefined;
	}

	return { state, verifier, redirectTo };
}
