import { timingSafeEqual } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';

import type { Database } from '../db/client.ts';
import { googleCodes } from '../db/schema.ts';
import { challengeFor, newSecret } from './google.ts';
import { hashToken } from './tokens.ts';

const LIFETIME_MS = 60_000;

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
