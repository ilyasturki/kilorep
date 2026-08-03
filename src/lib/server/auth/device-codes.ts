import { timingSafeEqual } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';

import type { Database } from '../db/client.ts';
import { googleCodes } from '../db/schema.ts';
import { challengeFor, newSecret } from './google.ts';
import { hashToken } from './tokens.ts';

/**
 * The last hop of the phone's Google sign-in: a single-use code the callback
 * puts on a deep link, traded over TLS for the device token itself.
 *
 * Why the token does not simply ride the deep link is in `googleCodes` — on
 * Android the scheme is claimed, not owned, so the return URL is a public
 * channel. This module is the part that makes a stolen URL worthless: the code
 * only spends against the verifier whose hash the app registered before the
 * browser ever opened.
 */

/**
 * Long enough for a Custom Tab to close and the app to come back to the
 * foreground; short enough that a code sitting in an intercepted URL stops
 * being interesting almost immediately. This is a handoff between two processes
 * on one device, not a window a person acts inside.
 */
const LIFETIME_MS = 60_000;

/**
 * Mints a code for `userId`, bound to the challenge the app registered.
 *
 * Expired rows are swept first. It costs one scan of a table that holds only
 * in-flight sign-ins — a handful of rows at the very most — and it means no
 * scheduled job exists solely to tidy up after ones abandoned halfway.
 */
export function issueCode(
	db: Database,
	userId: string,
	challenge: string,
	now: Date = new Date()
): string {
	db.delete(googleCodes).where(lt(googleCodes.expiresAt, now)).run();

	const code = newSecret();

	db.insert(googleCodes)
		.values({
			codeHash: hashToken(code),
			userId,
			challenge,
			expiresAt: new Date(now.getTime() + LIFETIME_MS)
		})
		.run();

	return code;
}

/**
 * Spends a code, returning the account it was minted for — or null for every
 * way that can fail, which are deliberately not told apart.
 *
 * The row is deleted before anything is checked, so a code is spent by being
 * presented at all. An attacker holding an intercepted URL gets exactly one
 * attempt at the verifier, and the legitimate app's own claim then fails too —
 * a visible, retryable sign-in failure, which is the outcome to prefer over
 * letting the guess be repeated.
 */
export function claimCode(
	db: Database,
	code: string,
	verifier: string,
	now: Date = new Date()
): string | null {
	const row = db
		.delete(googleCodes)
		.where(eq(googleCodes.codeHash, hashToken(code)))
		.returning()
		.get();

	if (row === undefined) {
		return null;
	}

	if (row.expiresAt.getTime() <= now.getTime()) {
		return null;
	}

	const presented = Buffer.from(challengeFor(verifier));
	const expected = Buffer.from(row.challenge);

	// `timingSafeEqual` throws on a length mismatch rather than returning false,
	// and a stored challenge of another length is a client that sent something
	// other than a base64url SHA-256 — refused, not crashed.
	if (presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
		return null;
	}

	return row.userId;
}
