import { beforeEach, describe, expect, test } from 'vitest';

import type { Database } from '../db/client.ts';
import { createDatabase } from '../db/client.ts';
import { migrationsFolder } from '../db/config.ts';
import { runMigrations } from '../db/migrate.ts';
import { googleCodes } from '../db/schema.ts';
import { createUser } from './accounts.ts';
import { claimCode, issueCode } from './device-codes.ts';
import { challengeFor } from './google.ts';

/**
 * The last hop of the phone's Google sign-in. What is worth testing here is
 * exactly what the code exists to prevent: a deep link that was intercepted
 * being worth something to whoever intercepted it.
 */

let db: Database;
let userId: string;

const VERIFIER = 'a-verifier-only-the-app-holds';

beforeEach(async () => {
	db = createDatabase(':memory:');
	runMigrations(db, migrationsFolder);

	const user = await createUser(db, 'lifter@example.com', 'a-long-enough-password');
	userId = user.id;
});

describe('claiming a device code', () => {
	test('a code plus its verifier resolves to the account', () => {
		const code = issueCode(db, userId, challengeFor(VERIFIER));

		expect(claimCode(db, code, VERIFIER)).toBe(userId);
	});

	test('the code alone is worth nothing — the interception case', () => {
		const code = issueCode(db, userId, challengeFor(VERIFIER));

		expect(claimCode(db, code, 'a guess')).toBeNull();
	});

	test('a code spends exactly once, even when the first attempt failed', () => {
		const code = issueCode(db, userId, challengeFor(VERIFIER));

		expect(claimCode(db, code, 'a guess')).toBeNull();
		// The legitimate app now fails too, and that is the intended trade: one
		// visible retry beats letting the guess be repeated.
		expect(claimCode(db, code, VERIFIER)).toBeNull();
	});

	test('an expired code is refused', () => {
		const issued = new Date(1_000_000);
		const code = issueCode(db, userId, challengeFor(VERIFIER), issued);

		const later = new Date(issued.getTime() + 61_000);
		expect(claimCode(db, code, VERIFIER, later)).toBeNull();
	});

	test('an unknown code is refused', () => {
		expect(claimCode(db, 'never-issued', VERIFIER)).toBeNull();
	});

	test('a challenge of the wrong length is refused rather than throwing', () => {
		// `timingSafeEqual` throws on a length mismatch, so the guard in front of
		// it is what turns a malformed client into a 401 instead of a 500.
		const code = issueCode(db, userId, 'short');

		expect(claimCode(db, code, VERIFIER)).toBeNull();
	});
});

describe('the pending-code table', () => {
	test('a claim leaves no row behind', () => {
		const code = issueCode(db, userId, challengeFor(VERIFIER));
		claimCode(db, code, VERIFIER);

		expect(db.select().from(googleCodes).all()).toHaveLength(0);
	});

	test('issuing sweeps codes that expired, and keeps the ones that did not', () => {
		const early = new Date(1_000_000);
		issueCode(db, userId, challengeFor('abandoned'), early);

		const late = new Date(early.getTime() + 61_000);
		const fresh = issueCode(db, userId, challengeFor(VERIFIER), late);

		const rows = db.select().from(googleCodes).all();
		expect(rows).toHaveLength(1);
		expect(claimCode(db, fresh, VERIFIER, late)).toBe(userId);
	});
});
