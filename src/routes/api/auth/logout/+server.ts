import { revokeToken } from '$lib/server/auth/accounts';
import { SESSION_COOKIE } from '$lib/server/auth/session';
import { getDatabase } from '$lib/server/db/client';
import { requireCredential } from '$lib/server/http/guards';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ locals, cookies }) => {
	const { user, token } = requireCredential(locals);

	revokeToken(getDatabase(), user.id, token.id);
	cookies.delete(SESSION_COOKIE, { path: '/' });

	return new Response(null, { status: 204 });
};
