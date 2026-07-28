import { eq } from 'drizzle-orm';

import type { Database } from '../db/client.ts';
import type { AuthToken, User } from '../db/schema.ts';
import { authTokens, users } from '../db/schema.ts';
import { hashToken } from './tokens.ts';

/**
 * Turning a request into an identity. One mechanism for all three clients: the
 * browser sends the secret in a cookie, the APK and MCP send it as a Bearer
 * header, and both resolve to the same row in `auth_tokens`.
 */

export const SESSION_COOKIE = 'kr_session';

/**
 * 400 days — the ceiling browsers enforce on cookie lifetime, so this is "as
 * long as the browser will allow". A cookie without one dies when the browser
 * closes, and being logged out by quitting Chrome is not what "never expires"
 * is supposed to mean.
 *
 * It bounds the credential as well as the cookie. Past this point the browser
 * has dropped the cookie regardless, so the row behind it can no longer be used
 * by the person it was issued to — and leaving it valid buys them nothing while
 * keeping a working secret alive for anyone who ever captured it. Device and
 * API credentials still never expire: those are revoked from the token list,
 * which is a place their owner can actually see them.
 */
const COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/** When a `web` credential minted now stops resolving. Matches its cookie exactly. */
export function webCredentialExpiry(now: Date = new Date()): Date {
	return new Date(now.getTime() + COOKIE_MAX_AGE_SECONDS * 1000);
}

/** `lastUsedAt` is a "when did I last see this device" display, not an audit log. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export type Credential = { user: User; token: AuthToken };

export type SessionCookieOptions = {
	path: string;
	httpOnly: boolean;
	sameSite: 'lax';
	secure: boolean;
	maxAge: number;
};

/**
 * `secure` is derived from the request rather than configured.
 *
 * A `Secure` cookie is refused outright by browsers when it arrives over plain
 * HTTP, and refused silently — login answers 204, the cookie is dropped, and
 * the app simply behaves as though it were logged out. Hard-coding it would
 * break every LAN self-hoster on `http://192.168.x.x` in the one way that
 * leaves no evidence. Behind a reverse proxy this needs adapter-node's
 * `PROTOCOL_HEADER=x-forwarded-proto`, or the server sees http and omits the
 * flag on a connection that deserved it.
 */
export function sessionCookieOptions(url: URL): SessionCookieOptions {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: url.protocol === 'https:',
		maxAge: COOKIE_MAX_AGE_SECONDS
	};
}

/** The secret from an `Authorization: Bearer …` header, if there is one. */
export function bearerToken(request: Request): string | null {
	const header = request.headers.get('authorization');
	if (header === null) {
		return null;
	}

	const [scheme, value] = header.split(' ');
	if (scheme === undefined || scheme.toLowerCase() !== 'bearer') {
		return null;
	}
	if (value === undefined || value === '') {
		return null;
	}

	return value;
}

/**
 * Records that a credential was used, at most once an hour.
 *
 * SQLite has a single writer, and a write on every authenticated request would
 * put the sync push behind the timestamp bookkeeping of whatever else is
 * talking to the server. An hour's resolution is more than a token list needs.
 */
function touch(db: Database, token: AuthToken, now: Date): void {
	if (token.lastUsedAt !== null && now.getTime() - token.lastUsedAt.getTime() < TOUCH_INTERVAL_MS) {
		return;
	}

	db.update(authTokens).set({ lastUsedAt: now }).where(eq(authTokens.id, token.id)).run();
}

/**
 * Resolves a cleartext secret to the account it belongs to, or null.
 *
 * One joined query: the token row is useless without the user and the user is
 * unreachable without the token, so asking for them separately would be two
 * round-trips to answer one question.
 *
 * There is no second comparison after the lookup, and there should not be one.
 * The row was found *by* `token_hash`, so whatever comes back matches byte for
 * byte by construction — a `timingSafeEqual` against a value equal to itself is
 * a branch that cannot be taken, and calling it a constant-time confirmation
 * describes a guarantee the indexed equality match already made or already
 * leaked. What actually makes timing a non-issue here is the secret: 256 bits
 * of CSPRNG output, with no guessable structure to walk one byte at a time.
 */
export function resolveCredential(db: Database, secret: string | null): Credential | null {
	if (secret === null || secret === '') {
		return null;
	}

	const hash = hashToken(secret);

	const row = db
		.select({ user: users, token: authTokens })
		.from(authTokens)
		.innerJoin(users, eq(users.id, authTokens.userId))
		.where(eq(authTokens.tokenHash, hash))
		.get();

	if (row === undefined) {
		return null;
	}

	const now = new Date();
	if (row.token.expiresAt !== null && row.token.expiresAt.getTime() <= now.getTime()) {
		return null;
	}

	touch(db, row.token, now);

	return row;
}
