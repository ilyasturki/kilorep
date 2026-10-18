import { and, eq, like } from 'drizzle-orm';

import { createUser, issueToken } from '../src/lib/server/auth/accounts.ts';
import { getDatabase } from '../src/lib/server/db/client.ts';
import { databasePath } from '../src/lib/server/db/config.ts';
import { runMigrations } from '../src/lib/server/db/migrate.ts';
import { records, users } from '../src/lib/server/db/schema.ts';

import { plant } from './seed/plant.ts';

const EMAIL = 'dev@kilorep.local';
// `createUser` enforces an eight-character minimum.
const PASSWORD = 'devdevdev';

const SEED_PREFIX = 'seed-';

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
