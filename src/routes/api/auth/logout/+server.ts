import { revokeToken } from '$lib/server/auth/accounts';
import { SESSION_COOKIE } from '$lib/server/auth/session';
import { getDatabase } from '$lib/server/db/client';
import { requireCredential } from '$lib/server/http/guards';

import type { RequestHandler } from './$types';

/**
 * Revokes the credential the request arrived with, and only that one — signing
 * out of the browser must not log the phone out of a workout.
 *
 * The cookie is cleared whether or not the caller used one. A Bearer client
 * has no cookie for this to affect, and the alternative is a branch that exists
 * only to skip a no-op.
 */

export const POST: RequestHandler = ({ locals, cookies }) => {
	const { user, token } = requireCredential(locals);

	revokeToken(getDatabase(), user.id, token.id);
	cookies.delete(SESSION_COOKIE, { path: '/' });

	return new Response(null, { status: 204 });
};
