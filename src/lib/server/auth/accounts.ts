import { and, eq } from 'drizzle-orm';

import type { Database } from '../db/client.ts';
import { isUniqueViolation } from '../db/errors.ts';
import { createSyncCounter } from '../db/seq.ts';
import type { AuthToken, User } from '../db/schema.ts';
import { authTokens, users } from '../db/schema.ts';
import { decoyHash, hashPassword, passwordProblem, verifyPassword } from './password.ts';
import { mintToken } from './tokens.ts';

/**
 * Account and credential operations. Every function here takes the `Database`
 * rather than reaching for the singleton, which is what lets the tests run each
 * case against a fresh file.
 */

/**
 * Case and surrounding space are not identity. Without this, retyping an
 * address with a capital letter creates a second account that looks like the
 * first and shares none of its data.
 */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/**
 * The shape check, not a deliverability check. Anything stricter is a losing
 * fight with the RFC, and this instance's operator knows their own address.
 */
export function emailProblem(email: string): string | undefined {
	const normalized = normalizeEmail(email);
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized)) {
		return 'email is not a valid address';
	}

	return undefined;
}

/**
 * Everything an account must satisfy to be created, in one expression.
 *
 * `createUser` is where this is enforced, and callers check it first only to
 * turn a violation into their own kind of answer — a 400 with the reason, a
 * message on a terminal. One function is what stops those two checks from
 * drifting apart, and the drift is worse than it looks: `createUser` reports a
 * violation by throwing, which `createUserIfNew` cannot tell apart from a real
 * failure, so a route whose copy disagreed would answer 500 where it meant 400.
 */
export function credentialProblem(email: string, password: string): string | undefined {
	return emailProblem(email) ?? passwordProblem(password);
}

export function findUserByEmail(db: Database, email: string): User | undefined {
	return db
		.select()
		.from(users)
		.where(eq(users.email, normalizeEmail(email)))
		.get();
}

export function listUsers(db: Database): User[] {
	return db.select().from(users).orderBy(users.createdAt).all();
}

/**
 * Creates an account and its sync counter in one transaction. The two are
 * inseparable: a user without a counter cannot be written to, because every
 * write claims a `seq` from it.
 */
export async function createUser(db: Database, email: string, password: string): Promise<User> {
	// Enforced here rather than only at the routes: the CLI creates accounts too,
	// and a rule that lives in one of two callers is not a rule.
	const problem = credentialProblem(email, password);
	if (problem !== undefined) {
		throw new Error(problem);
	}

	// Hashed before the transaction opens, never inside it: scrypt costs a third
	// of a second, and SQLite has one writer.
	const passwordHash = await hashPassword(password);

	return db.transaction((tx) => {
		const user = tx
			.insert(users)
			.values({
				id: crypto.randomUUID(),
				email: normalizeEmail(email),
				passwordHash,
				createdAt: new Date()
			})
			.returning()
			.get();

		createSyncCounter(tx, user.id);
		return user;
	});
}

export type CreateUserResult = { ok: true; user: User } | { ok: false; reason: 'duplicate' };

/**
 * `createUser`, with a duplicate address reported rather than thrown.
 *
 * Callers check for an existing address first, so this is only reached when two
 * sign-ups for the same address race — but that path deserves the same answer
 * the check would have given, not a 500. Written as a result rather than a
 * caught exception at the call site, so the route never has to name a `catch`
 * variable `error` while SvelteKit's `error` is in scope.
 */
export async function createUserIfNew(
	db: Database,
	email: string,
	password: string
): Promise<CreateUserResult> {
	try {
		return { ok: true, user: await createUser(db, email, password) };
	} catch (error) {
		if (isUniqueViolation(error)) {
			return { ok: false, reason: 'duplicate' };
		}
		throw error;
	}
}

/**
 * Deletes an account. Tokens and the sync counter go with it by cascade, which
 * only holds because `client.ts` turns foreign keys on per connection.
 */
export function deleteUser(db: Database, email: string): boolean {
	const removed = db
		.delete(users)
		.where(eq(users.email, normalizeEmail(email)))
		.returning({ id: users.id })
		.get();

	return removed !== undefined;
}

/**
 * Something to verify against when there is no account to verify against.
 * Nothing matches it, and failing to match costs exactly what matching costs.
 *
 * Built at import because building it is free — see `decoyHash`. The lazy
 * version this replaces was worse than no decoy in two ways: the first unknown
 * address a fresh process saw paid for the decoy's own scrypt run on top of the
 * verification, making it measurably slower than a known one, and a single
 * rejection cached a rejected promise for the life of the process, after which
 * every unknown address answered 500 while every known one still answered 401.
 */
const DECOY_HASH = decoyHash();

/**
 * Email and password to an account, or null.
 *
 * An unknown address still pays for a full scrypt verification. Returning early
 * would answer "is this address registered?" in microseconds rather than a third
 * of a second — an enumeration oracle that identical response bodies do nothing
 * to hide.
 */
export async function verifyLogin(
	db: Database,
	email: string,
	password: string
): Promise<User | null> {
	const user = findUserByEmail(db, email);

	if (user === undefined) {
		await verifyPassword(password, DECOY_HASH);
		return null;
	}

	const correct = await verifyPassword(password, user.passwordHash);
	return correct ? user : null;
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
			label: label.trim(),
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

export function listTokens(db: Database, userId: string): AuthToken[] {
	return db
		.select()
		.from(authTokens)
		.where(eq(authTokens.userId, userId))
		.orderBy(authTokens.createdAt)
		.all();
}

/**
 * Revokes a credential, scoped to its owner.
 *
 * The `userId` in the predicate is the tenant boundary, not an optimisation:
 * without it a token id — which the owner of any account can read from their own
 * list — would delete another account's credential. Returns false for both "no
 * such token" and "not yours", which is the same answer as far as a caller is
 * entitled to know.
 */
export function revokeToken(db: Database, userId: string, tokenId: string): boolean {
	const removed = db
		.delete(authTokens)
		.where(and(eq(authTokens.id, tokenId), eq(authTokens.userId, userId)))
		.returning({ id: authTokens.id })
		.get();

	return removed !== undefined;
}
