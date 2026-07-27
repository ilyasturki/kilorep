import type { Database } from '../db/client.ts';
import { createSyncCounter } from '../db/seq.ts';
import type { AuthToken, User } from '../db/schema.ts';
import { authTokens, users } from '../db/schema.ts';
import { hashPassword } from './password.ts';
import { mintToken } from './tokens.ts';

/**
 * Creates an account and its sync counter in one transaction. The two are
 * inseparable: a user without a counter cannot be written to, because every
 * write claims a `seq` from it.
 */
export async function createUser(db: Database, email: string, password: string): Promise<User> {
	// Hashed before the transaction opens, never inside it: scrypt costs a third
	// of a second, and SQLite has one writer.
	const passwordHash = await hashPassword(password);

	return db.transaction((tx) => {
		const user = tx
			.insert(users)
			.values({
				id: crypto.randomUUID(),
				email: email.trim().toLowerCase(),
				passwordHash,
				createdAt: new Date()
			})
			.returning()
			.get();

		createSyncCounter(tx, user.id);
		return user;
	});
}

/**
 * Issues a credential. The cleartext is returned here and nowhere else — it is
 * never stored and must never be logged.
 */
export function issueToken(
	db: Database,
	userId: string,
	label: string,
	kind: AuthToken['kind'],
	expiresAt: Date | null = null
): { token: string; record: AuthToken } {
	const { token, tokenHash, tokenPrefix } = mintToken();

	const record = db
		.insert(authTokens)
		.values({
			id: crypto.randomUUID(),
			userId,
			label,
			kind,
			tokenHash,
			tokenPrefix,
			createdAt: new Date(),
			expiresAt
		})
		.returning()
		.get();

	return { token, record };
}
