import { and, eq } from 'drizzle-orm';

import type { Database } from '../db/client.ts';
import { isUniqueViolation } from '../db/errors.ts';
import { createSyncCounter } from '../db/seq.ts';
import type { AuthToken, User } from '../db/schema.ts';
import { authTokens, users } from '../db/schema.ts';
import type { GoogleIdentity } from './google.ts';
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
 * `createUser` is where this is enforced; a caller checks it first only to turn
 * a violation into its own kind of answer — a message on a terminal rather than
 * a throw. One function is what stops the two checks from drifting apart, and
 * the drift is worse than it looks: `createUser` reports a violation by
 * throwing, which a caller cannot tell apart from a real failure, so a copy that
 * disagreed would report a bug where it meant "fix your input".
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

export function findUserByGoogleSub(db: Database, subject: string): User | undefined {
	return db.select().from(users).where(eq(users.googleSub, subject)).get();
}

export function listUsers(db: Database): User[] {
	return db.select().from(users).orderBy(users.createdAt).all();
}

/**
 * The row-and-counter insert both creation paths share.
 *
 * The two are inseparable: a user without a sync counter cannot be written to,
 * because every write claims a `seq` from it. One transaction is what guarantees
 * an account never exists in that state, and one function is what stops the
 * password path and the Google path from each having their own opinion about it.
 */
function insertUser(
	db: Database,
	email: string,
	passwordHash: string | null,
	googleSub: string | null
): User {
	return db.transaction((tx) => {
		const user = tx
			.insert(users)
			.values({
				id: crypto.randomUUID(),
				email: normalizeEmail(email),
				passwordHash,
				googleSub,
				createdAt: new Date()
			})
			.returning()
			.get();

		createSyncCounter(tx, user.id);
		return user;
	});
}

/** An account that signs in with a password. Only `account:create` reaches this. */
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

	return insertUser(db, email, passwordHash, null);
}

/**
 * Keeps the stored address on the one the person actually uses.
 *
 * Identity never depends on this column — that is `googleSub`'s job — so a
 * refused update is cosmetic. It is refused rather than forced when the new
 * address already belongs to another row, because the alternative is that
 * somebody else's account existing is enough to lock you out of yours: a denial
 * of service wearing a correctness costume. The operator's CLI addresses
 * accounts by email, so the drift is worth a line in the log.
 */
function syncEmail(db: Database, user: User, email: string): User {
	const normalized = normalizeEmail(email);
	if (normalized === user.email) {
		return user;
	}

	try {
		return db
			.update(users)
			.set({ email: normalized })
			.where(eq(users.id, user.id))
			.returning()
			.get();
	} catch (error) {
		if (isUniqueViolation(error)) {
			console.warn(
				`account ${user.id} now signs in as ${normalized}, which another account already holds; keeping ${user.email}`
			);
			return user;
		}
		throw error;
	}
}

export type GoogleResolution =
	| { ok: true; user: User; outcome: 'signed-in' | 'linked' | 'created' }
	| { ok: false; reason: 'closed' | 'claimed' };

/**
 * Everything that happens between "Google says who this is" and "here is the
 * account", with no HTTP and no network in sight — which is the point. The rule
 * about who may create an account and which existing one an identity attaches to
 * is the part worth testing exhaustively, and it is testable here.
 *
 * Three ways in, in order:
 *
 * 1. **A subject we have seen.** Sign in. The address may have moved since; see
 *    below.
 * 2. **A subject we have not, whose verified address we know.** Link, and note
 *    that this happens whether or not the instance is open — linking is not
 *    creation. It is how an operator moves their `account:create` account onto
 *    Google without ever accepting a stranger.
 * 3. **Neither.** A new account, if this instance takes them.
 */
export function resolveGoogleIdentity(
	db: Database,
	identity: GoogleIdentity,
	registrationOpen: boolean
): GoogleResolution {
	const known = findUserByGoogleSub(db, identity.subject);
	if (known !== undefined) {
		return { ok: true, user: syncEmail(db, known, identity.email), outcome: 'signed-in' };
	}

	const byEmail = findUserByEmail(db, identity.email);
	if (byEmail !== undefined) {
		// The address belongs to an account that is already somebody else's Google
		// identity. Legitimately reachable — a Workspace mailbox deleted and
		// recreated gets a fresh subject — but indistinguishable from a takeover,
		// and the safe answer is the one that changes nothing. The operator can
		// resolve it with `account:delete`, which is a decision a person should be
		// making anyway.
		if (byEmail.googleSub !== null) {
			return { ok: false, reason: 'claimed' };
		}

		const linked = db
			.update(users)
			.set({ googleSub: identity.subject })
			.where(eq(users.id, byEmail.id))
			.returning()
			.get();

		return { ok: true, user: linked, outcome: 'linked' };
	}

	if (!registrationOpen) {
		return { ok: false, reason: 'closed' };
	}

	return {
		ok: true,
		user: insertUser(db, identity.email, null, identity.subject),
		outcome: 'created'
	};
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
 *
 * An account with no password hash — one that has only ever signed in with
 * Google — takes that same path, and for both of its reasons. It must refuse,
 * because there is no password to be right; and it must refuse *slowly*, or the
 * timing says "this address exists and signs in with Google", which is a fact
 * about somebody that nobody asked them.
 */
export async function verifyLogin(
	db: Database,
	email: string,
	password: string
): Promise<User | null> {
	const user = findUserByEmail(db, email);

	if (user === undefined || user.passwordHash === null) {
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
