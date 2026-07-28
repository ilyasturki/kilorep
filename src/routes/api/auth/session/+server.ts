import { json } from '@sveltejs/kit';

import { requireCredential } from '$lib/server/http/guards';
import { publicToken, publicUser } from '$lib/server/http/shapes';

import type { RequestHandler } from './$types';

/**
 * Who the caller is, and which credential said so. The client's way to ask "am
 * I still signed in?" without guessing from a 401 on some unrelated request.
 */

export const GET: RequestHandler = ({ locals }) => {
	const { user, token } = requireCredential(locals);

	return json({ user: publicUser(user), credential: publicToken(token, true) });
};
