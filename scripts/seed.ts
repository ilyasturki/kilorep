import { eq } from 'drizzle-orm';

import { createUser, issueToken } from '../src/lib/server/auth/accounts.ts';
import { getDatabase } from '../src/lib/server/db/client.ts';
import { databasePath } from '../src/lib/server/db/config.ts';
import { runMigrations } from '../src/lib/server/db/migrate.ts';
import { users } from '../src/lib/server/db/schema.ts';

/**
 * Development bootstrap only. Production account creation is deliberately
 * unsolved — see STACK.md's open questions — and this script is not the
 * answer: the credentials below are public, in the repository.
 */

const EMAIL = 'dev@kilorep.local';
// Eight characters because `createUser` enforces a floor and this is a caller
// like any other; there is nothing else to read into the value.
const PASSWORD = 'devdevdev';

if (process.env.NODE_ENV === 'production') {
	console.error('refusing to seed: NODE_ENV is production, and these credentials are public');
	process.exit(1);
}

const db = getDatabase();
runMigrations(db);

const existing = db.select().from(users).where(eq(users.email, EMAIL)).get();

if (existing) {
	console.log(`already seeded: ${EMAIL} (${existing.id}) in ${databasePath}`);
	process.exit(0);
}

const user = await createUser(db, EMAIL, PASSWORD);
const { token } = issueToken(db, user.id, 'seed device', 'device');

console.log(`seeded ${databasePath}`);
console.log(`  email:    ${EMAIL}`);
console.log(`  password: ${PASSWORD}`);
console.log(`  token:    ${token}`);
