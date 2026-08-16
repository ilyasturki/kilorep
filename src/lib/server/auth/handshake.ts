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

// sameSite must stay 'lax': the callback is a cross-site top-level navigation
// from Google, and 'strict' would withhold the cookie on exactly that request.
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
