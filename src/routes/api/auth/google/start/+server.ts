import { redirect } from '@sveltejs/kit';

import { authorizationUrl, callbackUri, newSecret } from '$lib/server/auth/google';
import { setHandshake } from '$lib/server/auth/handshake';
import { requireGoogleClient } from '$lib/server/http/guards';
import { resolveRedirect } from '$lib/api/redirect';

import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url, cookies }) => {
	const client = requireGoogleClient();

	const state = newSecret();
	const verifier = newSecret();

	const redirectTo = resolveRedirect(url.searchParams.get('redirectTo'), url.origin);

	const supplied = url.searchParams.get('challenge');
	const challenge = supplied === null || supplied === '' ? undefined : supplied;

	setHandshake(cookies, url, { state, verifier, redirectTo, challenge });

	redirect(
		303,
		authorizationUrl({
			clientId: client.id,
			redirectUri: callbackUri(url.origin),
			state,
			verifier
		})
	);
};
