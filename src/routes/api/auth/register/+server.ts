import { error, json } from '@sveltejs/kit';

import type { CreateUserResult } from '$lib/server/auth/accounts';
import { createUserIfNew, credentialProblem, findUserByEmail } from '$lib/server/auth/accounts';
import {
	acquireVerificationSlot,
	recordRegistration,
	registrationBlocked,
	saturated
} from '$lib/server/auth/throttle';
import { registrationOpen } from '$lib/server/config';
import { getDatabase } from '$lib/server/db/client';
import { readJsonBody, requiredString } from '$lib/server/http/body';
import { publicUser } from '$lib/server/http/shapes';

import type { RequestHandler } from './$types';

/**
 * Self-service sign-up, for a hosted instance with more than one user. It ships
 * closed and a normal self-hosted install never opens it: `account:create` makes
 * the first account locally, so there is no bootstrap that requires exposing
 * this even briefly.
 *
 * Creating an account does not sign you in. The client logs in afterwards like
 * any other client, which keeps one code path minting credentials.
 */

export const POST: RequestHandler = async ({ request, getClientAddress }) => {
	if (!registrationOpen()) {
		// 404 rather than 403: a disabled endpoint has nothing to say about
		// whether it exists.
		error(404, 'not found');
	}

	const body = await readJsonBody(request);
	const email = requiredString(body, 'email');
	const password = requiredString(body, 'password');

	const problem = credentialProblem(email, password);
	if (problem !== undefined) {
		error(400, problem);
	}

	const address = getClientAddress();
	if (registrationBlocked(address)) {
		error(429, 'too many accounts created from here, try again later');
	}

	const db = getDatabase();

	// Enumeration is unavoidable on a route whose whole job is to say whether an
	// address can be registered, and pretending otherwise would only make the
	// error useless. This is the reason it is off by default.
	if (findUserByEmail(db, email) !== undefined) {
		error(409, 'email is already registered');
	}

	if (saturated()) {
		error(503, 'too many sign-up attempts in flight, try again');
	}

	// Counted here rather than after the insert, so the number bounds the scrypt
	// runs this route will do — every request that gets this far is about to
	// spend one, whether or not it ends up with an account. The slot below bounds
	// how fast they happen; this is what bounds how many.
	recordRegistration(address);

	// Registration hashes a password too, so it takes the same slot login does.
	// Guarding only login would move the denial of service one route sideways
	// rather than remove it.
	const release = await acquireVerificationSlot();
	let result: CreateUserResult;
	try {
		result = await createUserIfNew(db, email, password);
	} finally {
		release();
	}

	if (!result.ok) {
		// The check above lost a race with a simultaneous identical sign-up.
		error(409, 'email is already registered');
	}

	return json(publicUser(result.user), { status: 201 });
};
