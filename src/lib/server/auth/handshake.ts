import type { Cookies } from '@sveltejs/kit';

import { GOOGLE_BASE } from '../../api/routes.ts';
import { isRecord } from '../json.ts';
import { secureCookies } from './session.ts';

export const HANDSHAKE_COOKIE = 'kr_oauth';

const COOKIE_PATH = GOOGLE_BASE;

const MAX_AGE_SECONDS = 10 * 60;

export type Handshake = {
	state: string;
	verifier: string;
	redirectTo: string;
	challenge?: string;
};

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

	const { state, verifier, redirectTo, challenge } = parsed;
	if (typeof state !== 'string' || typeof verifier !== 'string' || typeof redirectTo !== 'string') {
		return undefined;
	}

	return {
		state,
		verifier,
		redirectTo,
		challenge: typeof challenge === 'string' ? challenge : undefined
	};
}
