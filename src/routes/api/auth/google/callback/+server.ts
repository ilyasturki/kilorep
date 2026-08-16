import { redirect } from '@sveltejs/kit';

import { resolveGoogleIdentity } from '$lib/server/auth/accounts';
import { issueCode } from '$lib/server/auth/device-codes';
import type { IdentityProblem } from '$lib/server/auth/google';
import { callbackUri, exchangeCode } from '$lib/server/auth/google';
import { takeHandshake } from '$lib/server/auth/handshake';
import { SESSION_COOKIE, sessionCookieOptions, startWebSession } from '$lib/server/auth/session';
import { registrationOpen } from '$lib/server/config';
import { getDatabase } from '$lib/server/db/client';
import { requireGoogleClient } from '$lib/server/http/guards';
import { DEVICE_REDIRECT } from '$lib/api/routes';
import { resolveRedirect } from '$lib/api/redirect';

import type { RequestHandler } from './$types';

function refusalTo(origin: string, device: boolean): (message: string) => never {
	const base = device ? DEVICE_REDIRECT : `${origin}/login`;

	return (message: string): never => {
		if (message === '' && !device) {
			redirect(303, base);
		}

		redirect(303, `${base}?error=${encodeURIComponent(message)}`);
	};
}

const REFUSALS: Record<IdentityProblem, string> = {
	unreachable: 'could not reach Google, try again',
	malformed: 'could not verify that Google account, try again',
	'wrong-issuer': 'could not verify that Google account, try again',
	'wrong-audience': 'could not verify that Google account, try again',
	expired: 'that sign-in expired, try again',
	'unverified-email': 'that Google account has no verified email address'
};

export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	const client = requireGoogleClient();

	const handshake = takeHandshake(cookies, url);

	const challenge = handshake === undefined ? undefined : handshake.challenge;

	// TypeScript narrows past a never-returning call only through an explicitly typed name.
	const refuse: (message: string) => never = refusalTo(url.origin, challenge !== undefined);

	if (url.searchParams.get('error') !== null) {
		refuse('');
	}

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	if (handshake === undefined || code === null || state === null || state !== handshake.state) {
		refuse('that sign-in expired, try again');
	}

	const result = await exchangeCode({
		code,
		redirectUri: callbackUri(url.origin),
		clientId: client.id,
		clientSecret: client.secret,
		verifier: handshake.verifier
	});

	if (!result.ok) {
		refuse(REFUSALS[result.problem]);
	}

	const db = getDatabase();
	const resolution = resolveGoogleIdentity(db, result.identity, registrationOpen());

	if (!resolution.ok) {
		refuse(
			resolution.reason === 'closed'
				? 'this server does not accept new accounts'
				: 'that email address already belongs to another account'
		);
	}

	if (challenge !== undefined) {
		const issued = issueCode(db, resolution.user.id, challenge);

		redirect(303, `${DEVICE_REDIRECT}?code=${encodeURIComponent(issued)}`);
	}

	const { token } = startWebSession(db, resolution.user.id, locals.credential);
	cookies.set(SESSION_COOKIE, token, sessionCookieOptions(url));

	redirect(303, `${url.origin}${resolveRedirect(handshake.redirectTo, url.origin)}`);
};
