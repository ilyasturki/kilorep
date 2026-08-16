import { json } from '@sveltejs/kit';

import { requireCredential } from '$lib/server/http/guards';
import { publicToken, publicUser } from '$lib/server/http/shapes';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ locals }) => {
	const { user, token } = requireCredential(locals);

	return json({ user: publicUser(user), credential: publicToken(token, true) });
};
