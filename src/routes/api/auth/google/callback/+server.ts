import { error, redirect } from '@sveltejs/kit';

import { resolveGoogleIdentity } from '$lib/server/auth/accounts';
import { issueCode } from '$lib/server/auth/device-codes';
import type { IdentityProblem } from '$lib/server/auth/google';
import { callbackUri, exchangeCode } from '$lib/server/auth/google';
import { takeHandshake } from '$lib/server/auth/handshake';
import { SESSION_COOKIE, sessionCookieOptions, startWebSession } from '$lib/server/auth/session';
import { googleClient, registrationOpen } from '$lib/server/config';
import { getDatabase } from '$lib/server/db/client';
import { DEVICE_REDIRECT } from '$lib/api/routes';
import { resolveRedirect } from '$lib/api/redirect';

import type { RequestHandler } from './$types';

/**
 * Where Google sends the browser back, and the only place an account is created
 * over the network.
 *
 * Every failure leaves as a redirect carrying a message, never as a JSON error.
 * The caller is a person who followed a redirect out of a browser tab, and a
 * bare 400 in place of a page is a dead end with a back button — the status code
 * has nobody to inform. Failures are told apart by *what the person can do about
 * it*, which is why "this server does not accept new accounts" and "something
 * went wrong" are separate messages and the rest are not.
 *
 * Two clients end here and they part company at the very last step. A browser
 * gets the session cookie and goes back to where it was. A phone — which had to
 * run this in a Custom Tab, because Google answers `disallowed_useragent` inside
 * a WebView, and which could not use this cookie anyway since the WebView's
 * origin is not this server's — gets a single-use code on its own scheme and
 * trades it for a device token at `claim`. Which one this is was decided at
 * `start` and is remembered in the handshake cookie, never read off this
 * request: everything on this URL came back through Google and anyone can forge
 * it, and a forged `?client=device` would divert a browser's sign-in to whatever
 * app holds the scheme.
 */

/**
 * Where a failure lands, bound once to the client that started this rather than
 * decided again at each exit — a message the login screen will render, in the
 * voice the rest of it uses, or the same message on the deep link the app's
 * listener is waiting on.
 *
 * The device branch cannot fall back to `/login`: the Custom Tab has no session
 * to land in and would strand a page the app never sees, with the app still
 * waiting on a return that never comes.
 *
 * An empty message is Google's own Cancel, where nothing went wrong and there is
 * nothing to report. The browser is simply put back where it started; the phone
 * still needs telling, or its Custom Tab sits open on a page that has finished
 * with it.
 */
function refusalTo(origin: string, device: boolean): (message: string) => never {
	return (message: string): never => {
		if (device) {
			redirect(303, `${DEVICE_REDIRECT}?error=${encodeURIComponent(message)}`);
		}

		redirect(
			303,
			message === '' ? `${origin}/login` : `${origin}/login?error=${encodeURIComponent(message)}`
		);
	};
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

	// Which client started this, and the only trustworthy statement of it — see
	// the note above. Absent for the failures below that happen before there is a
	// handshake to ask, where `/login` is the only destination there is: a phone
	// in that state has no code coming and reports the sign-in as failed on its
	// own, which is the truth.
	const challenge = handshake === undefined ? undefined : handshake.challenge;

	// Annotated rather than inferred: control flow only reads a call as
	// never-returning — which is what lets the checks below narrow past a
	// `refuse` — when the name it goes through carries an explicit type.
	const refuse: (message: string) => never = refusalTo(url.origin, challenge !== undefined);

	// Google's own refusal — the consent screen's Cancel, most often.
	if (url.searchParams.get('error') !== null) {
		refuse('');
	}

	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');

	if (handshake === undefined || code === null || state === null) {
		// A stale tab, a cookie that expired mid-consent, or a link somebody sent.
		refuse('that sign-in expired, try again');
	}

	// The CSRF check. A callback the browser did not start has a state that
	// matches nothing here, and this is the line that refuses it.
	if (state !== handshake.state) {
		refuse('that sign-in expired, try again');
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
		refuse(REFUSALS[result.problem]);
	}

	const db = getDatabase();
	const resolution = resolveGoogleIdentity(db, result.identity, registrationOpen());

	if (!resolution.ok) {
		refuse(
			resolution.reason === 'closed'
				? 'this server does not accept new accounts'
				: 'that email address already belongs to another account'
		);
	}

	// The phone's half ends here, one hop short of a credential: what leaves is a
	// code, and the token is minted at `claim` for whoever can produce the
	// verifier behind `handshake.challenge`. No cookie is set on the way — this
	// browser is the system's, not the app's, and a session left in it would be
	// one nobody asked for and nobody can see to end.
	if (challenge !== undefined) {
		const issued = issueCode(db, resolution.user.id, challenge);

		redirect(303, `${DEVICE_REDIRECT}?code=${encodeURIComponent(issued)}`);
	}

	const { token } = startWebSession(db, resolution.user.id, locals.credential);
	cookies.set(SESSION_COOKIE, token, sessionCookieOptions(url));

	// `redirectTo` was validated by `resolveRedirect` before it went into the
	// cookie, and the cookie is HttpOnly — but it has been out of this process and
	// back since, so it is resolved once more on the way out. The cost is a string
	// comparison; the alternative is trusting a round-trip.
	redirect(303, `${url.origin}${resolveRedirect(handshake.redirectTo, url.origin)}`);
};
