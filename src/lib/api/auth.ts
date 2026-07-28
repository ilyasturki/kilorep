import { request } from './client.ts';

/**
 * The three auth calls the web surface makes, spelled once.
 *
 * `client: 'web'` is the reason this file exists rather than three `request`
 * calls at three call sites. The login route branches on it and the branches
 * are not interchangeable: `web` sets an HttpOnly cookie and answers 204,
 * while `device` and `api` answer 201 with the secret in the body and demand a
 * `label`. Getting it wrong on the web surface means a token printed into a
 * response the page cannot store and a session that was never established —
 * and nothing about that failure names the field that caused it.
 */

/**
 * Restated rather than imported. `$lib/server/http/shapes.ts` is the authority
 * on the wire format, and SvelteKit refuses to bundle anything under
 * `$lib/server` into client code — correctly, since that module reaches the
 * database row types. Only the fields the client actually reads are declared,
 * so the copy is small enough to keep honest.
 */
export type Account = {
	id: string;
	email: string;
	/** Epoch milliseconds, matching the schema's convention. */
	createdAt: number;
};

export type Session = {
	user: Account;
};

type Fetch = typeof globalThis.fetch;

/**
 * On success the secret arrives as a `Set-Cookie` the page can neither read nor
 * needs to; there is nothing to return. Failures throw `ApiError` with the
 * server's own wording — `invalid email or password` for a bad credential,
 * and the throttle's messages for 429 and 503.
 */
export async function login(email: string, password: string, fetch?: Fetch): Promise<void> {
	await request<undefined>('/api/auth/login', {
		method: 'POST',
		body: { email, password, client: 'web' },
		fetch
	});
}

/** Revokes the credential the request arrives with, and only that one. */
export async function logout(fetch?: Fetch): Promise<void> {
	await request<undefined>('/api/auth/logout', { method: 'POST', fetch });
}

/**
 * Who the caller is. Throws `ApiError` with status 401 when nobody — which is
 * the answer the guards are actually asking for, not an exceptional case.
 */
export async function session(fetch?: Fetch): Promise<Session> {
	const result = await request<Session>('/api/auth/session', { fetch });
	return result;
}
