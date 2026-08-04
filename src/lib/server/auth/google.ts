import { randomBytes, createHash } from 'node:crypto';

import { GOOGLE_CALLBACK_PATH } from '../../api/routes.ts';
import { isRecord, jsonObject } from '../json.ts';

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

/**
 * Google has issued tokens under both spellings for years and its discovery
 * document names the first; both are Google and neither is anybody else.
 */
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com']);

const SCOPE = 'openid email profile';

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
	subject: string;
	email: string;
};

export function newSecret(): string {
	return randomBytes(32).toString('base64url');
}

export function challengeFor(verifier: string): string {
	return createHash('sha256').update(verifier).digest('base64url');
}

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
	url.searchParams.set('access_type', 'online');

	return url.toString();
}

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
