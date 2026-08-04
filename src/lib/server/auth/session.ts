import { eq } from 'drizzle-orm';

import type { Database } from '../db/client.ts';
import type { AuthToken, User } from '../db/schema.ts';
import { authTokens, users } from '../db/schema.ts';
import { issueToken, revokeToken } from './accounts.ts';
import { hashToken } from './tokens.ts';

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

export function webCredentialExpiry(now: Date = new Date()): Date {
	return new Date(now.getTime() + COOKIE_MAX_AGE_SECONDS * 1000);
}

const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

export type Credential = { user: User; token: AuthToken };

export type SessionCookieOptions = {
	path: string;
	httpOnly: boolean;
	sameSite: 'lax';
	secure: boolean;
	maxAge: number;
};

export function secureCookies(url: URL): boolean {
	return url.protocol === 'https:';
}

export function sessionCookieOptions(url: URL): SessionCookieOptions {
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: secureCookies(url),
		maxAge: COOKIE_MAX_AGE_SECONDS
	};
}

export function bearerToken(request: Request): string | null {
	const [scheme, value] = (request.headers.get('authorization') ?? '').split(' ');
	if (scheme === undefined || scheme.toLowerCase() !== 'bearer') {
		return null;
	}
	if (value === undefined || value === '') {
		return null;
	}

	return value;
}

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

export function startWebSession(
	db: Database,
	userId: string,
	previous: Credential | null
): { token: string; record: AuthToken } {
	if (previous !== null && previous.token.kind === 'web' && previous.user.id === userId) {
		revokeToken(db, userId, previous.token.id);
	}

	return issueToken(db, userId, 'Web', 'web', webCredentialExpiry());
}
