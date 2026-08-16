import { error } from '@sveltejs/kit';

import { revokeToken } from '$lib/server/auth/accounts';
import { SESSION_COOKIE } from '$lib/server/auth/session';
import { getDatabase } from '$lib/server/db/client';
import { requireCredential } from '$lib/server/http/guards';

import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = ({ locals, params, cookies }) => {
	const { user, token } = requireCredential(locals);

	if (!revokeToken(getDatabase(), user.id, params.id)) {
		error(404, 'no such credential');
	}

	if (params.id === token.id) {
		cookies.delete(SESSION_COOKIE, { path: '/' });
	}

	return new Response(null, { status: 204 });
};
