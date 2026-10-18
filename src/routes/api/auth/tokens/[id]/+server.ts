import { error, json } from '@sveltejs/kit';

import { renameToken, revokeToken } from '$lib/server/auth/accounts';
import { SESSION_COOKIE } from '$lib/server/auth/session';
import { getDatabase } from '$lib/server/db/client';
import { readJsonBody, requiredString } from '$lib/server/http/body';
import { requireCredential } from '$lib/server/http/guards';
import { publicToken } from '$lib/server/http/shapes';

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

export const PATCH: RequestHandler = async ({ request, locals, params }) => {
	const { user, token } = requireCredential(locals);

	const body = await readJsonBody(request);
	const label = requiredString(body, 'label');

	const record = renameToken(getDatabase(), user.id, params.id, label);

	if (record === undefined) {
		error(404, 'no such credential');
	}

	return json(publicToken(record, record.id === token.id));
};
