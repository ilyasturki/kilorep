import { error, json } from '@sveltejs/kit';

import { issueToken } from '$lib/server/auth/accounts';
import { claimCode } from '$lib/server/auth/device-codes';
import { getDatabase } from '$lib/server/db/client';
import { readJsonBody, requiredString } from '$lib/server/http/body';
import { requireGoogleClient } from '$lib/server/http/guards';
import { publicToken } from '$lib/server/http/shapes';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	requireGoogleClient();

	const body = await readJsonBody(request);
	const code = requiredString(body, 'code');
	const verifier = requiredString(body, 'verifier');
	const label = requiredString(body, 'label');

	const db = getDatabase();
	const userId = claimCode(db, code, verifier);

	if (userId === null) {
		error(401, 'that sign-in expired, try again');
	}

	const { token, record } = issueToken(db, userId, label, 'device');

	return json({ token, credential: publicToken(record, false) }, { status: 201 });
};
