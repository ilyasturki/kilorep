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

const EMAIL = 'dev@kilorep.local';
// `createUser` enforces an eight-character minimum.
const PASSWORD = 'devdevdev';

const SEED_PREFIX = 'seed-';

function plant(db: Database, userId: string, now: number): number {
	const { templates, workouts, bodyweight } = seedContent(now);

	return db.transaction((tx) => {
		const rows = [
			...templates.map(({ template, deletedAt }) => ({
				id: template.id,
				kind: 'template' as const,
				// `updatedAt` must move with `deletedAt`, or the delete loses last-write-wins and undeletes.
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
			// A day has exactly one bodyweight id, so these rows cannot carry the seed prefix:
			// they are invisible to the planted-count check, and `--force` overwrites hand-logged weights.
			...bodyweight.map(({ entry, loggedAt }) => ({
				id: bodyweightId(entry.date),
				kind: 'bodyweight' as const,
				updatedAt: loggedAt,
				deletedAt: null,
				payload: entry
			}))
		];

		for (const row of rows) {
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

let user = db.select().from(users).where(eq(users.email, EMAIL)).get();

if (user === undefined) {
	user = await createUser(db, EMAIL, PASSWORD);
	const { token } = issueToken(db, user.id, 'seed device', 'device');

	console.log(`seeded ${databasePath}`);
	console.log(`  email:    ${EMAIL}`);
	console.log(`  password: ${PASSWORD}`);
	console.log(`  token:    ${token}`);
} else {
	console.log(`account already seeded: ${EMAIL} (${user.id}) in ${databasePath}`);
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
