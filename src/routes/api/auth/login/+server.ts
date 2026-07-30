import { error, json } from '@sveltejs/kit';

import { issueToken, normalizeEmail, verifyLogin } from '$lib/server/auth/accounts';
import { SESSION_COOKIE, sessionCookieOptions, startWebSession } from '$lib/server/auth/session';
import {
	acquireVerificationSlot,
	clearLoginFailures,
	loginBlocked,
	recordLoginFailure,
	saturated
} from '$lib/server/auth/throttle';
import { getDatabase } from '$lib/server/db/client';
import type { AuthToken, User } from '$lib/server/db/schema';
import { readJsonBody, requiredString } from '$lib/server/http/body';
import { publicToken } from '$lib/server/http/shapes';

import type { RequestHandler } from './$types';

/**
 * One route for all three clients. What differs is delivery, and the request
 * says which it wants — never the User-Agent, which is a guess dressed as a
 * fact.
 *
 * - `client: "web"` → the secret goes back as an HttpOnly cookie and appears
 *   nowhere in the body, so a script injection on the web surface cannot read
 *   it.
 * - `client: "device" | "api"` → the secret is returned once, in the body, and
 *   no cookie is set. Requires a `label`, because a credential you cannot
 *   recognise in a list is one you will never dare revoke.
 */

function isClient(value: unknown): value is AuthToken['kind'] {
	return value === 'web' || value === 'device' || value === 'api';
}

export const POST: RequestHandler = async ({ request, cookies, url, locals, getClientAddress }) => {
	const body = await readJsonBody(request);
	const email = requiredString(body, 'email');
	const password = requiredString(body, 'password');

	const client = body.client;
	if (!isClient(client)) {
		error(400, 'client must be one of: web, device, api');
	}

	// Read before verifying, so a malformed request is refused in microseconds
	// rather than after a third of a second of scrypt. Only `device` and `api`
	// carry one — a browser credential is named by `startWebSession`, which owns
	// every other part of that decision too.
	const label = client === 'web' ? null : requiredString(body, 'label');

	const address = getClientAddress();
	// Counted against the account as well as the address, so that signing in
	// somewhere else successfully cannot wipe the record of guesses against this
	// one — see `clearLoginFailures`.
	const account = normalizeEmail(email);

	if (loginBlocked(address, account)) {
		error(429, 'too many failed attempts, try again later');
	}
	if (saturated()) {
		error(503, 'too many sign-in attempts in flight, try again');
	}

	const db = getDatabase();

	const release = await acquireVerificationSlot();
	let user: User | null;
	try {
		user = await verifyLogin(db, email, password);
	} finally {
		release();
	}

	if (user === null) {
		recordLoginFailure(address, account);
		// One message for both an unknown address and a wrong password. The
		// timing matches too — see `verifyLogin`.
		error(401, 'invalid email or password');
	}

	clearLoginFailures(address, account);

	// `label` is null exactly when `client` is `web` — the two were decided
	// together above.
	if (label === null) {
		const { token } = startWebSession(db, user.id, locals.credential);
		cookies.set(SESSION_COOKIE, token, sessionCookieOptions(url));
		return new Response(null, { status: 204 });
	}

	const { token, record } = issueToken(db, user.id, label, client);
	return json({ token, credential: publicToken(record, false) }, { status: 201 });
};
