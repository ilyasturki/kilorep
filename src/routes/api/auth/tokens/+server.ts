import { error, json } from '@sveltejs/kit';

import { issueToken, listTokens } from '$lib/server/auth/accounts';
import { getDatabase } from '$lib/server/db/client';
import { readJsonBody, requiredString } from '$lib/server/http/body';
import { requireCredential } from '$lib/server/http/guards';
import { publicToken } from '$lib/server/http/shapes';

import type { RequestHandler } from './$types';

/**
 * The credential list, and minting a new one.
 *
 * Since nothing expires, this list is the entire safety mechanism: it is where
 * a phone that was lost, or a token pasted into a tool you stopped trusting,
 * gets taken away. Which is why it exists now rather than with the Settings
 * screen that will eventually display it.
 */

/**
 * `web` is deliberately not mintable here. A web credential is delivered as a
 * cookie by logging in; minting one through this route would create a row whose
 * secret is handed to the caller as a string, which is the exact property the
 * cookie exists to avoid.
 */
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

	// The cleartext appears here and never again — it is stored only as a hash.
	return json({ token, credential: publicToken(record, false) }, { status: 201 });
};
