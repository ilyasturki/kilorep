import { ApiError, NO_SERVER, apiBase, request } from './client.ts';
import { GOOGLE_ENABLED_PATH, GOOGLE_START_PATH } from './routes.ts';

/**
 * The auth calls the web surface makes, spelled once — plus the one thing here
 * that is not a call at all: `googleSignInUrl` builds a link the browser
 * *navigates* to, because signing in with Google means leaving this origin.
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

/**
 * A credential as the list endpoint describes it — the same restatement rule
 * as `Account` above. `prefix` is the only piece of the secret that survives
 * minting; it exists so a token pasted into a tool can be matched to its row.
 */
export type PublicToken = {
	id: string;
	label: string;
	kind: 'web' | 'device' | 'api';
	prefix: string;
	/** Epoch milliseconds; the two nullables have simply never happened yet. */
	createdAt: number;
	lastUsedAt: number | null;
	expiresAt: number | null;
	/** The credential this very request arrived with. */
	current: boolean;
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

/** Every credential on the account, the caller's own marked `current`. */
export async function listTokens(fetch?: Fetch): Promise<PublicToken[]> {
	const tokens = await request<PublicToken[]>('/api/auth/tokens', { fetch });
	return tokens;
}

/**
 * Mints an `api` token. The cleartext in the response is the only time the
 * secret ever exists outside a hash — the caller shows it once or loses it.
 *
 * Always `api`: `device` is the shell sign-in's kind to mint when that flow
 * exists, and `web` is a cookie the server refuses to hand out as a string.
 */
export async function createToken(
	label: string,
	fetch?: Fetch
): Promise<{ token: string; credential: PublicToken }> {
	const minted = await request<{ token: string; credential: PublicToken }>('/api/auth/tokens', {
		method: 'POST',
		body: { label, kind: 'api' },
		fetch
	});

	return minted;
}

/**
 * Revocation — how access ends, since nothing expires. Revoking the credential
 * the request rides on is a logout, and the server finishes that job itself.
 */
export async function revokeToken(id: string, fetch?: Fetch): Promise<void> {
	await request<undefined>(`/api/auth/tokens/${id}`, { method: 'DELETE', fetch });
}

/**
 * Whether this server can offer Google sign-in.
 *
 * False rather than a throw when the server cannot be reached: the login screen
 * asks this in order to decide what to draw, and a server that is down has no
 * Google sign-in to offer either. The password form is what it falls back to,
 * which is the one thing that might still work.
 */
export async function googleEnabled(fetch?: Fetch): Promise<boolean> {
	try {
		const { enabled } = await request<{ enabled: boolean }>(GOOGLE_ENABLED_PATH, { fetch });
		return enabled;
	} catch {
		return false;
	}
}

/**
 * The href behind "Continue with Google" — a destination to navigate to, never
 * something to `fetch`.
 *
 * Built through `apiBase()` rather than written as a relative `/api/…`, because
 * a relative one works on the web surface and 404s in the APK, where the origin
 * is the WebView's and not the server's. That is hard rule 4, and this is
 * exactly the shape it is about: an `href` looks even less like an API call than
 * a `fetch` does, so it is the easiest place to forget.
 *
 * Unreachable without a server, and it refuses anyway. `googleEnabled()` above
 * answers `false` when there is none — `request` raises `NO_SERVER` and the
 * catch swallows it — so the button this href belongs to is never drawn. The
 * guard is for the day something else calls this: `new URL(path, null)` throws
 * a bare `TypeError: Invalid URL`, which no caller can tell apart from a
 * malformed path and which names nothing about the cause. `NO_SERVER` says
 * what happened, and says it in the one type the callers already catch.
 */
export function googleSignInUrl(redirectTo: string): string {
	const base = apiBase();

	if (base === null) {
		throw new ApiError(NO_SERVER, 'no server connected');
	}

	const url = new URL(GOOGLE_START_PATH, base);
	url.searchParams.set('redirectTo', redirectTo);
	return url.toString();
}
