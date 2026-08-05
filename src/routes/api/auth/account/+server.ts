import { error } from '@sveltejs/kit';

import { deleteUser, normalizeEmail } from '$lib/server/auth/accounts';
import { SESSION_COOKIE } from '$lib/server/auth/session';
import { getDatabase } from '$lib/server/db/client';
import { readJsonBody, requiredString } from '$lib/server/http/body';
import { requireCredential } from '$lib/server/http/guards';

import type { RequestHandler } from './$types';

/**
 * Deleting the account the request arrived with, and everything the server
 * holds for it. The one irreversible endpoint in the app.
 *
 * The retyped address is checked here as well as in the form, because a
 * confirmation that only exists on the client is worth nothing: this is what a
 * script holding a stolen API token has to get past, and the token itself does
 * not carry the address.
 *
 * 403 and never 401 on a mismatch, for the reason the password route gives at
 * length: `request` in `$lib/api/client` drops the device token on any 401, so
 * a mistyped address would sign the phone out of the server it is standing in
 * front of. The credential was good; the typing was not.
 *
 * Every table naming a user cascades from the row, so the delete is the whole
 * of it — the cookie is cleared only to spare the browser a request that would
 * be refused anyway.
 */
export const DELETE: RequestHandler = async ({ request, locals, cookies }) => {
	const { user } = requireCredential(locals);

	const body = await readJsonBody(request);
	const email = requiredString(body, 'email');

	if (normalizeEmail(email) !== user.email) {
		error(403, 'that is not this account’s email address');
	}

	deleteUser(getDatabase(), user.email);
	cookies.delete(SESSION_COOKIE, { path: '/' });

	return new Response(null, { status: 204 });
};
