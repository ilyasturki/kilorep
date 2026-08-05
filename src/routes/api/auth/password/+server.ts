import { error } from '@sveltejs/kit';

import { currentPasswordRequired, revokeOtherTokens, setPassword } from '$lib/server/auth/accounts';
import { passwordProblem, verifyPassword } from '$lib/server/auth/password';
import {
	acquireVerificationSlot,
	clearLoginFailures,
	loginBlocked,
	recordLoginFailure,
	saturated
} from '$lib/server/auth/throttle';
import { getDatabase } from '$lib/server/db/client';
import { readJsonBody, requiredString } from '$lib/server/http/body';
import { requireCredential } from '$lib/server/http/guards';

import type { RequestHandler } from './$types';

/**
 * Setting a password, whether or not there was one before. One route for both,
 * because they differ only in what has to be proved first — see
 * `currentPasswordRequired`, which is where that is decided and the only place
 * it is.
 *
 * `revokeOthers` defaults to *false* on the wire and to on in the form. Not a
 * contradiction: the form is a screen with somebody in front of it who can be
 * told what the switch does, and an API client that never sent the field did
 * not decide anything about the phone in its owner's bag.
 */

export const POST: RequestHandler = async ({ request, locals, getClientAddress }) => {
	const { user, token } = requireCredential(locals);

	const body = await readJsonBody(request);
	const password = requiredString(body, 'password');

	const problem = passwordProblem(password);
	if (problem !== undefined) {
		error(400, problem);
	}

	const revokeOthers = body.revokeOthers === true;

	const db = getDatabase();

	if (currentPasswordRequired(user)) {
		const current = requiredString(body, 'current');

		// The same counters login uses, keyed the same way. It is the same secret
		// being guessed at, so guesses made here have to spend the same budget —
		// otherwise a stolen session cookie is an unthrottled oracle for the
		// password behind it, and the fifteen-minute lockout at the front door
		// means nothing.
		const address = getClientAddress();
		if (loginBlocked(address, user.email)) {
			error(429, 'too many failed attempts, try again later');
		}
		if (saturated()) {
			error(503, 'too many sign-in attempts in flight, try again');
		}

		const release = await acquireVerificationSlot();
		let correct: boolean;
		try {
			// Not null: `currentPasswordRequired` is how we got in here.
			correct = await verifyPassword(current, user.passwordHash ?? '');
		} finally {
			release();
		}

		if (!correct) {
			recordLoginFailure(address, user.email);

			// 403 and never 401, which would be the honest-looking code and the
			// wrong one: `request` in `$lib/api/client` drops the device token on
			// any 401, so answering a mistyped current password that way would
			// sign the phone out of the server it was trying to stay on. The
			// credential presented here was perfectly good — it is the password
			// typed into the form that was not.
			error(403, 'current password is wrong');
		}

		clearLoginFailures(address, user.email);
	}

	await setPassword(db, user.id, password);

	if (revokeOthers) {
		revokeOtherTokens(db, user.id, token.id);
	}

	return new Response(null, { status: 204 });
};
