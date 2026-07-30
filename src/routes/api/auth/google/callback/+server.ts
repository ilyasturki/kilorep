import { error, redirect } from '@sveltejs/kit';

import { resolveGoogleIdentity } from '$lib/server/auth/accounts';
import type { IdentityProblem } from '$lib/server/auth/google';
import { callbackUri, exchangeCode } from '$lib/server/auth/google';
import { takeHandshake } from '$lib/server/auth/handshake';
import { SESSION_COOKIE, sessionCookieOptions, startWebSession } from '$lib/server/auth/session';
import { googleClient, registrationOpen } from '$lib/server/config';
import { getDatabase } from '$lib/server/db/client';
import { resolveRedirect } from '$lib/api/redirect';

import type { RequestHandler } from './$types';

/**
 * Where Google sends the browser back, and the only place an account is created
 * over the network.
 *
 * Every failure leaves as a redirect to `/login` carrying a message, never as a
 * JSON error. The caller is a person who followed a redirect out of a browser
 * tab, and a bare 400 in place of a page is a dead end with a back button — the
 * status code has nobody to inform. Failures are told apart by *what the person
 * can do about it*, which is why "this server does not accept new accounts" and
 * "something went wrong" are separate messages and the rest are not.
 *
 * Not usable by the future APK. Google refuses OAuth inside an embedded WebView
 * (`disallowed_useragent`), so the phone will need a system browser and a
 * deep-link return, and what comes back has to be a device token rather than a
 * cookie — the WebView's origin is not this server's, so this cookie would not
 * apply to it. Deliberately not built for today: Capacitor is not installed, and
 * a contract written against a shell that does not exist would key off nothing.
 * See `apiBase()` in `$lib/api/client`, which defers the same question.
 */

/** A message the login screen will render, in the voice the rest of it uses. */
function refuse(origin: string, message: string): never {
	redirect(303, `${origin}/login?error=${encodeURIComponent(message)}`);
}

/**
 * One message per way a token can fail, and they are mostly the same message on
 * purpose. A person who cannot sign in is owed either something to do or an
 * honest "not your fault"; "wrong-audience" is neither, and spelling it out
 * would only describe the server's configuration to whoever asked.
 */
const REFUSALS: Record<IdentityProblem, string> = {
	unreachable: 'could not reach Google, try again',
	malformed: 'could not verify that Google account, try again',
	'wrong-issuer': 'could not verify that Google account, try again',
	'wrong-audience': 'could not verify that Google account, try again',
	expired: 'that sign-in expired, try again',
	'unverified-email': 'that Google account has no verified email address'
};

export const GET: RequestHandler = async ({ url, cookies, locals }) => {
	const client = googleClient();
	if (client === undefined) {
		error(404, 'not found');
	}

	// Taken first, and unconditionally: whatever else happens, this handshake is
	// spent. Leaving it behind would let a code be retried against a state that
	// is still good.
	const handshake = takeHandshake(cookies, url);

	// Google's own refusal — the consent screen's Cancel, most often. Nothing went
	// wrong and there is nothing to report; the person is simply back where they
	// started.
	if (url.searchParams.get('error') !== null) {
		redirect(303, `${url.origin}/login`);
	}

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	if (handshake === undefined || code === null || state === null) {
		// A stale tab, a cookie that expired mid-consent, or a link somebody sent.
		refuse(url.origin, 'that sign-in expired, try again');
	}

	// The CSRF check. A callback the browser did not start has a state that
	// matches nothing here, and this is the line that refuses it.
	if (state !== handshake.state) {
		refuse(url.origin, 'that sign-in expired, try again');
	}

	const result = await exchangeCode({
		code,
		redirectUri: callbackUri(url.origin),
		clientId: client.id,
		clientSecret: client.secret,
		verifier: handshake.verifier
	});

	if (!result.ok) {
		// Whatever detail there was is already in the log — see `google.ts`. What
		// reaches the browser is only what its reader could act on, which for every
		// case but one is "try again".
		refuse(url.origin, REFUSALS[result.problem]);
	}

	const db = getDatabase();
	const resolution = resolveGoogleIdentity(db, result.identity, registrationOpen());

	if (!resolution.ok) {
		refuse(
			url.origin,
			resolution.reason === 'closed'
				? 'this server does not accept new accounts'
				: 'that email address already belongs to another account'
		);
	}

	const { token } = startWebSession(db, resolution.user.id, locals.credential);
	cookies.set(SESSION_COOKIE, token, sessionCookieOptions(url));

	// `redirectTo` was validated by `resolveRedirect` before it went into the
	// cookie, and the cookie is HttpOnly — but it has been out of this process and
	// back since, so it is resolved once more on the way out. The cost is a string
	// comparison; the alternative is trusting a round-trip.
	redirect(303, `${url.origin}${resolveRedirect(handshake.redirectTo, url.origin)}`);
};
