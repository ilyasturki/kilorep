import { error } from '@sveltejs/kit';

import { revokeToken } from '$lib/server/auth/accounts';
import { SESSION_COOKIE } from '$lib/server/auth/session';
import { getDatabase } from '$lib/server/db/client';
import { requireCredential } from '$lib/server/http/guards';

import type { RequestHandler } from './$types';

/**
 * Revocation, which with nothing expiring is how access ever ends.
 *
 * Scoped to the caller's own account inside `revokeToken` — a token id read
 * from your own list must not delete someone else's credential.
 */

export const DELETE: RequestHandler = ({ locals, params, cookies }) => {
	const { user, token } = requireCredential(locals);

	if (!revokeToken(getDatabase(), user.id, params.id)) {
		// Also the answer for a token that exists but belongs to someone else.
		error(404, 'no such credential');
	}

	// Revoking the credential you are holding is a logout, so finish the job.
	if (params.id === token.id) {
		cookies.delete(SESSION_COOKIE, { path: '/' });
	}

	return new Response(null, { status: 204 });
};
