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
			correct = await verifyPassword(current, user.passwordHash ?? '');
		} finally {
			release();
		}

		if (!correct) {
			recordLoginFailure(address, user.email);

			// 403, never 401: `$lib/api/client` drops the device token on any 401.
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
