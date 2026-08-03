import { error, redirect } from '@sveltejs/kit';

import { authorizationUrl, callbackUri, newSecret } from '$lib/server/auth/google';
import { setHandshake } from '$lib/server/auth/handshake';
import { googleClient } from '$lib/server/config';
import { resolveRedirect } from '$lib/api/redirect';

import type { RequestHandler } from './$types';

/**
 * Sends the browser to Google.
 *
 * A `GET` that redirects, reached by navigating rather than by `fetch`, because
 * the whole point is to leave this origin. Everything else the client does goes
 * through `$lib/api/client`; this one is a link, and the login page builds it
 * from `apiBase()` for the same reason that module exists — see hard rule 4.
 *
 * The browser is not always this server's. The phone opens this same URL in a
 * Custom Tab — Google refuses OAuth inside a WebView, answering
 * `disallowed_useragent` — with a `challenge` that says so, and the callback
 * finishes somewhere else entirely. One route for both because everything
 * between here and the identity is identical; what differs is only who the
 * credential is handed to at the end.
 */

export const GET: RequestHandler = ({ url, cookies }) => {
	const client = googleClient();
	if (client === undefined) {
		// The same answer the endpoint gives when it does not exist. An instance
		// with no identity provider has nothing to say about one.
		error(404, 'not found');
	}

	const state = newSecret();
	const verifier = newSecret();

	// Validated on the way in as well as on the way out. The value is
	// attacker-supplied — anyone can send a link to this URL — and it is about to
	// be stored in a cookie and trusted after a round-trip through another site,
	// which is the worst possible moment to be holding an unchecked destination.
	const redirectTo = resolveRedirect(url.searchParams.get('redirectTo'), url.origin);

	// Taken as written, and it does not need to be trusted: the value only ever
	// travels back out to the app that supplied it, and the one thing it can do
	// is fail to match a verifier at claim time. An empty parameter is dropped
	// rather than stored, so `?challenge=` cannot produce a device handshake
	// nothing has to prove.
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
