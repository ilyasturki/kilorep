import { error, json } from '@sveltejs/kit';

import { issueToken } from '$lib/server/auth/accounts';
import { claimCode } from '$lib/server/auth/device-codes';
import { getDatabase } from '$lib/server/db/client';
import { readJsonBody, requiredString } from '$lib/server/http/body';
import { requireGoogleClient } from '$lib/server/http/guards';
import { publicToken } from '$lib/server/http/shapes';

import type { RequestHandler } from './$types';

/**
 * The phone's last step: a single-use code plus the verifier behind the
 * challenge it registered, traded for the device token itself.
 *
 * The one call in the Google flow the app makes directly, over TLS to the
 * address it is configured with — everything before it happened in a browser
 * this process does not control. That is the whole point of the split: the deep
 * link that came back can be read by any app that claimed the scheme, and what
 * it carries is worth nothing without the verifier, which never left this
 * device.
 *
 * Public, like the rest of the Google routes: nobody holds a credential yet, and
 * minting the first one is what this is for. The code is the authentication.
 */

export const POST: RequestHandler = async ({ request }) => {
	requireGoogleClient();

	const body = await readJsonBody(request);
	const code = requiredString(body, 'code');
	const verifier = requiredString(body, 'verifier');
	const label = requiredString(body, 'label');

	const db = getDatabase();
	const userId = claimCode(db, code, verifier);

	// One message for an unknown code, an expired one and a wrong verifier
	// alike, the same rule login follows for an unknown address and a bad
	// password. There is nothing here the legitimate app can act on differently,
	// and nothing an interceptor should be told.
	if (userId === null) {
		error(401, 'that sign-in expired, try again');
	}

	const { token, record } = issueToken(db, userId, label, 'device');

	return json({ token, credential: publicToken(record, false) }, { status: 201 });
};
