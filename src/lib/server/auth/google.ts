import { randomBytes, createHash } from 'node:crypto';

import { GOOGLE_CALLBACK_PATH } from '../../api/routes.ts';
import { isRecord, jsonObject } from '../json.ts';

/**
 * The Google half of sign-in: build an authorization URL, turn the code it
 * comes back with into a verified identity. Two `fetch` calls and no dependency.
 *
 * Hardcoded to Google rather than written against OIDC discovery. One provider
 * was the decision, and discovery for a single known issuer is a request, a
 * cache and a failure mode bought for two constants that have not moved in a
 * decade.
 *
 * Nothing here touches the database or decides who the identity *is* — that is
 * `resolveGoogleIdentity` in `accounts.ts`, deliberately separate so the rule
 * about linking and creating can be tested without a network.
 */

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/**
 * Google has issued tokens under both spellings for years and its discovery
 * document names the first; both are Google and neither is anybody else.
 */
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

/** Identity only. No Drive, no calendar, nothing that would need a review. */
const SCOPE = 'openid email profile';

/**
 * Where Google sends the browser back. Must match an Authorized redirect URI in
 * the Cloud console *exactly*, and that mismatch is the single most common way
 * this ends up misconfigured — it surfaces as `redirect_uri_mismatch` on
 * Google's own page, before any code here runs again.
 *
 * Derived from the request rather than configured, so a LAN instance on
 * `http://192.168.1.50:3000` and a public one on `https://kilorep.example.com`
 * each ask for themselves. Behind a reverse proxy this needs adapter-node's
 * `PROTOCOL_HEADER`, or the scheme is http and the URI does not match what the
 * console holds.
 */
export function callbackUri(origin: string): string {
	return new URL(GOOGLE_CALLBACK_PATH, origin).toString();
}

/**
 * Tolerance for the `exp` check. Two machines' clocks disagree, and a sign-in
 * refused because the server is thirty seconds fast is unexplainable to the
 * person it happens to.
 */
const CLOCK_SKEW_MS = 60 * 1000;

export type GoogleIdentity = {
	/** The stable per-client subject id. Identity keys on this, never on `email`. */
	subject: string;
	email: string;
};

/**
 * A fresh unguessable string, for both halves the browser carries: the `state`
 * Google echoes back, and the PKCE verifier, which never leaves this server in
 * any form but the hash below.
 */
export function newSecret(): string {
	return randomBytes(32).toString('base64url');
}

/**
 * PKCE's `S256`: the one spelling of a challenge that both legs must agree on.
 *
 * Here rather than beside either caller because there are two — the exchange
 * with Google below, and our own leg between the phone and `device-codes.ts`.
 * Same construction, same threat, one hop apart.
 */
export function challengeFor(verifier: string): string {
	return createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Where to send the browser.
 *
 * PKCE is included even though this is a confidential client exchanging with a
 * secret. It costs one hash and closes code injection — an attacker who obtains
 * a code elsewhere cannot spend it here, because they cannot produce the
 * verifier behind the challenge this request started with. OAuth 2.1 makes it
 * mandatory; there is no reason to be last to adopt it.
 */
export function authorizationUrl(options: {
	clientId: string;
	redirectUri: string;
	state: string;
	verifier: string;
}): string {
	const url = new URL(AUTHORIZATION_ENDPOINT);

	url.searchParams.set('client_id', options.clientId);
	url.searchParams.set('redirect_uri', options.redirectUri);
	url.searchParams.set('response_type', 'code');
	url.searchParams.set('scope', SCOPE);
	url.searchParams.set('state', options.state);
	url.searchParams.set('code_challenge', challengeFor(options.verifier));
	url.searchParams.set('code_challenge_method', 'S256');
	// No refresh token, so no consent screen on every return visit: this asks who
	// you are once and never acts on your behalf afterwards.
	url.searchParams.set('access_type', 'online');

	return url.toString();
}

/**
 * The payload of a JWT, without verifying its signature.
 *
 * That is not an oversight and it is not a shortcut worth being nervous about.
 * This token was not handed over by the browser — it came back on the body of a
 * request this process made directly to Google's token endpoint over TLS, and
 * OIDC Core §3.1.3.7 says in as many words that TLS server validation may stand
 * in for the signature check in exactly that case. The claims are still checked;
 * what is skipped is fetching a JWKS and carrying a JWT library to re-derive a
 * fact TLS already established.
 */
function readClaims(idToken: string): Record<string, unknown> | undefined {
	const parts = idToken.split('.');
	if (parts.length !== 3) {
		return undefined;
	}

	try {
		const payload: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
		return isRecord(payload) ? payload : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Why a sign-in produced no identity. The route turns these into a message, and
 * only `unverified-email` earns one of its own — it is the single case the
 * person in the browser can actually do something about.
 *
 * `unreachable` covers every way the exchange itself failed: DNS, TLS, a refused
 * connection, a non-2xx from the token endpoint, a body with no token in it.
 * They are one outcome here because they are one outcome to the caller, and the
 * detail that separates them is written to the log, where the operator is.
 */
export type IdentityProblem =
	'unreachable' | 'malformed' | 'wrong-issuer' | 'wrong-audience' | 'expired' | 'unverified-email';

export type IdentityResult =
	{ ok: true; identity: GoogleIdentity } | { ok: false; problem: IdentityProblem };

/**
 * Every claim that has to hold before a token is allowed to name a person.
 *
 * `aud` is the one that is easy to skip and must not be: without it, a token
 * minted for a *different* Google client — anybody's — signs its bearer in here.
 * `email_verified` is the second: an unverified address is a string somebody
 * typed, and this design links accounts by address.
 */
export function verifyClaims(idToken: string, clientId: string, now: number): IdentityResult {
	const claims = readClaims(idToken);
	if (claims === undefined) {
		return { ok: false, problem: 'malformed' };
	}

	if (typeof claims.iss !== 'string' || !ISSUERS.has(claims.iss)) {
		return { ok: false, problem: 'wrong-issuer' };
	}

	if (claims.aud !== clientId) {
		return { ok: false, problem: 'wrong-audience' };
	}

	if (typeof claims.exp !== 'number' || claims.exp * 1000 + CLOCK_SKEW_MS < now) {
		return { ok: false, problem: 'expired' };
	}

	if (typeof claims.sub !== 'string' || claims.sub === '') {
		return { ok: false, problem: 'malformed' };
	}

	if (typeof claims.email !== 'string' || claims.email === '') {
		return { ok: false, problem: 'malformed' };
	}

	// Google sends a boolean; some older responses sent the string. Anything that
	// is not an affirmative one of those two is treated as unverified.
	if (claims.email_verified !== true && claims.email_verified !== 'true') {
		return { ok: false, problem: 'unverified-email' };
	}

	return { ok: true, identity: { subject: claims.sub, email: claims.email } };
}

export type CodeExchange = {
	code: string;
	redirectUri: string;
	clientId: string;
	clientSecret: string;
	verifier: string;
};

async function fetchIdToken(options: CodeExchange): Promise<string | undefined> {
	let response: Response;

	try {
		response = await fetch(TOKEN_ENDPOINT, {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded' },
			body: new URLSearchParams({
				code: options.code,
				client_id: options.clientId,
				client_secret: options.clientSecret,
				redirect_uri: options.redirectUri,
				grant_type: 'authorization_code',
				code_verifier: options.verifier
			})
		});
	} catch (error) {
		console.error('could not reach the google token endpoint:', error);
		return undefined;
	}

	if (!response.ok) {
		// Google's `error_description` names the misconfiguration, and nine times
		// out of ten it is a redirect_uri that does not match the console. Written
		// to the log because that is where the person who can fix it is looking.
		console.error(`google token endpoint answered ${response.status}:`, await response.text());
		return undefined;
	}

	const payload = (await jsonObject(response)) ?? {};
	const idToken = payload.id_token;

	if (typeof idToken !== 'string') {
		console.error('google token endpoint returned no usable id_token');
		return undefined;
	}

	return idToken;
}

export async function exchangeCode(options: CodeExchange): Promise<IdentityResult> {
	const idToken = await fetchIdToken(options);
	if (idToken === undefined) {
		return { ok: false, problem: 'unreachable' };
	}

	return verifyClaims(idToken, options.clientId, Date.now());
}
