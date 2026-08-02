import { and, eq, like } from 'drizzle-orm';

import { bodyweightId } from '../src/lib/domain/bodyweight.ts';
import { createUser, issueToken } from '../src/lib/server/auth/accounts.ts';
import { getDatabase } from '../src/lib/server/db/client.ts';
import { databasePath } from '../src/lib/server/db/config.ts';
import type { Database } from '../src/lib/server/db/client.ts';
import { runMigrations } from '../src/lib/server/db/migrate.ts';
import { records, users } from '../src/lib/server/db/schema.ts';
import { claimSeq } from '../src/lib/server/db/seq.ts';

import { seedContent } from './seed/content.ts';

/**
 * Development bootstrap only: the credentials below are public, in the
 * repository. A real instance makes its first account with
 * `bun run account:create`, which never touches the network.
 *
 * Two halves. The account is the one `docs/TESTING.md` documents and the
 * reason this script exists; the content is eight weeks of training planted on
 * it, so a fresh worktree opens on an app that has been used rather than on a
 * hint system with nothing to recall. Both halves are idempotent — the second
 * run says so and changes nothing — and `--force` replants the content against
 * today's date without touching anything logged by hand.
 */

const EMAIL = 'dev@kilorep.local';
// Eight characters because `createUser` enforces a floor and this is a caller
// like any other; there is nothing else to read into the value.
const PASSWORD = 'devdevdev';

/**
 * Every id `seedContent` mints starts with this, which is what makes the
 * content half idempotent *and* non-destructive: the planter recognises its
 * own rows by prefix, so replanting overwrites those and leaves a workout you
 * logged in the browser exactly where it is.
 */
const SEED_PREFIX = 'seed-';

/**
 * Writes the seed as sync records, one claimed `seq` each, all in one
 * transaction — CLAUDE.md's rule, and here the claim and the write are the
 * same statement's arguments so they cannot come apart.
 *
 * Templates first, then sessions oldest to newest, so the seqs tell the story
 * in the order it happened. Upsert rather than insert because `--force` runs
 * over ids that already exist; a client that has synced already pulls the
 * replacements on its next round trip, since every replanted row claims a
 * fresh seq above its watermark.
 */
function plant(db: Database, userId: string, now: number): number {
	const { templates, workouts, bodyweight } = seedContent(now);

	return db.transaction((tx) => {
		const rows = [
			...templates.map(({ template, deletedAt }) => ({
				id: template.id,
				kind: 'template' as const,
				// The tombstone rule: `updatedAt` moves with `deletedAt`, or a delete
				// carrying the older timestamp loses last-write-wins and undeletes
				// itself on the next pull.
				updatedAt: deletedAt ?? template.createdAt,
				deletedAt,
				payload: template
			})),
			...workouts.map((workout) => ({
				id: workout.id,
				kind: 'workout' as const,
				updatedAt: workout.finishedAt,
				deletedAt: null,
				payload: workout
			})),
			// The one kind that cannot wear the seed prefix: a day's entry has
			// exactly one id, `bodyweight-<date>`, or the app's own put for that
			// day would sit beside the seed's as a duplicate. The costs are small
			// and accepted — the planted-count check above does not see these
			// rows (the prefixed ones already answer it), and a `--force` replant
			// overwrites a hand-logged weight on a day the seed covers.
			...bodyweight.map(({ entry, loggedAt }) => ({
				id: bodyweightId(entry.date),
				kind: 'bodyweight' as const,
				updatedAt: loggedAt,
				deletedAt: null,
				payload: entry
			}))
		];

		for (const row of rows) {
			// Spelled field by field for the reason `store.finishWorkout` gives: object
			// spread is linted out of everything but a component, and the explicit shape
			// means a column added to `records` fails the build here rather than going
			// quietly unwritten on every seeded row.
			const values = {
				userId,
				seq: claimSeq(tx, userId),
				id: row.id,
				kind: row.kind,
				updatedAt: row.updatedAt,
				deletedAt: row.deletedAt,
				payload: row.payload
			};

			tx.insert(records)
				.values(values)
				.onConflictDoUpdate({ target: [records.userId, records.id], set: values })
				.run();
		}

		return rows.length;
	});
}

if (process.env.NODE_ENV === 'production') {
	console.error('refusing to seed: NODE_ENV is production, and these credentials are public');
	process.exit(1);
}

const force = process.argv.includes('--force');

const db = getDatabase();
runMigrations(db);

const existing = db.select().from(users).where(eq(users.email, EMAIL)).get();

if (existing) {
	console.log(`account already seeded: ${EMAIL} (${existing.id}) in ${databasePath}`);
} else {
	const created = await createUser(db, EMAIL, PASSWORD);
	const { token } = issueToken(db, created.id, 'seed device', 'device');

	console.log(`seeded ${databasePath}`);
	console.log(`  email:    ${EMAIL}`);
	console.log(`  password: ${PASSWORD}`);
	console.log(`  token:    ${token}`);
}

const user = existing ?? db.select().from(users).where(eq(users.email, EMAIL)).get();

if (user === undefined) {
	throw new Error(`the account went missing right after it was written: ${EMAIL}`);
}

const planted = db
	.select({ id: records.id })
	.from(records)
	.where(and(eq(records.userId, user.id), like(records.id, `${SEED_PREFIX}%`)))
	.all();

if (planted.length > 0 && !force) {
	console.log(
		`content already planted: ${planted.length} records — 'bun run db:seed --force' replants`
	);
} else {
	const count = plant(db, user.id, Date.now());

	console.log(`planted ${count} records: eight weeks of training and weigh-ins, ending yesterday`);
	console.log('  sign in and the launch sync pulls it onto the device');
}
