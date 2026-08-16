import { error, json } from '@sveltejs/kit';

import { issueToken, listTokens } from '$lib/server/auth/accounts';
import { getDatabase } from '$lib/server/db/client';
import { readJsonBody, requiredString } from '$lib/server/http/body';
import { requireCredential } from '$lib/server/http/guards';
import { publicToken } from '$lib/server/http/shapes';

import type { RequestHandler } from './$types';

function isMintableKind(value: unknown): value is 'device' | 'api' {
	return value === 'device' || value === 'api';
}

export const GET: RequestHandler = ({ locals }) => {
	const { user, token } = requireCredential(locals);

	return json(
		listTokens(getDatabase(), user.id).map((record) => publicToken(record, record.id === token.id))
	);
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireCredential(locals);

	const body = await readJsonBody(request);
	const label = requiredString(body, 'label');

	const kind = body.kind ?? 'api';
	if (!isMintableKind(kind)) {
		error(400, 'kind must be one of: device, api');
	}

	const { token, record } = issueToken(getDatabase(), user.id, label, kind);

	return json({ token, credential: publicToken(record, false) }, { status: 201 });
};
