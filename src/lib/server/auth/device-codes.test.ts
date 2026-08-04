import { beforeEach, describe, expect, test } from 'vitest';

import type { Database } from '../db/client.ts';
import { createDatabase } from '../db/client.ts';
import { runMigrations } from '../db/migrate.ts';
import { googleCodes } from '../db/schema.ts';
import { createUser } from './accounts.ts';
import { claimCode, issueCode } from './device-codes.ts';
import { challengeFor } from './google.ts';

let db: Database;
let userId: string;

const VERIFIER = 'a-verifier-only-the-app-holds';

beforeEach(async () => {
	db = createDatabase(':memory:');
	runMigrations(db);

	const user = await createUser(db, 'lifter@example.com', 'a-long-enough-password');
	userId = user.id;
});

describe('claiming a device code', () => {
	test('a code plus its verifier resolves to the account, exactly once', () => {
		const code = issueCode(db, userId, challengeFor(VERIFIER));

		expect(claimCode(db, code, VERIFIER)).toBe(userId);
		expect(claimCode(db, code, VERIFIER)).toBeNull();
	});

	test('the code alone is worth nothing, and spends anyway — the interception case', () => {
		const code = issueCode(db, userId, challengeFor(VERIFIER));

		expect(claimCode(db, code, 'a guess')).toBeNull();
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
		const code = issueCode(db, userId, 'short');

		expect(claimCode(db, code, VERIFIER)).toBeNull();
	});
});

describe('the pending-code table', () => {
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
