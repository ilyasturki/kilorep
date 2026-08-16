import { error } from '@sveltejs/kit';

import { deleteUser, normalizeEmail } from '$lib/server/auth/accounts';
import { SESSION_COOKIE } from '$lib/server/auth/session';
import { getDatabase } from '$lib/server/db/client';
import { readJsonBody, requiredString } from '$lib/server/http/body';
import { requireCredential } from '$lib/server/http/guards';

import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ request, locals, cookies }) => {
	const { user } = requireCredential(locals);

	const body = await readJsonBody(request);
	const email = requiredString(body, 'email');

	if (normalizeEmail(email) !== user.email) {
		// 403, never 401: `$lib/api/client` drops the device token on any 401.
		error(403, 'that is not this account’s email address');
	}

	deleteUser(getDatabase(), user.email);
	cookies.delete(SESSION_COOKIE, { path: '/' });

	return new Response(null, { status: 204 });
};
