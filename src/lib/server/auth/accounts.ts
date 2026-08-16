import { and, eq, ne } from 'drizzle-orm';

import type { Database } from '../db/client.ts';
import { isUniqueViolation } from '../db/errors.ts';
import type { AuthToken, User } from '../db/schema.ts';
import { authTokens, syncCounters, users } from '../db/schema.ts';
import type { GoogleIdentity } from './google.ts';
import { decoyHash, hashPassword, passwordProblem, verifyPassword } from './password.ts';
import { mintToken } from './tokens.ts';

export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

export function emailProblem(email: string): string | undefined {
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalizeEmail(email))) {
		return 'email is not a valid address';
	}

	return undefined;
}

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

		tx.insert(syncCounters).values({ userId: user.id }).run();
		return user;
	});
}

export async function createUser(db: Database, email: string, password: string): Promise<User> {
	const problem = credentialProblem(email, password);
	if (problem !== undefined) {
		throw new Error(problem);
	}

	const passwordHash = await hashPassword(password);

	return insertUser(db, email, passwordHash, null);
}

export function currentPasswordRequired(user: User): boolean {
	return user.passwordHash !== null && user.googleSub === null;
}

export async function setPassword(db: Database, userId: string, password: string): Promise<void> {
	const problem = passwordProblem(password);
	if (problem !== undefined) {
		throw new Error(problem);
	}

	const passwordHash = await hashPassword(password);

	db.update(users).set({ passwordHash }).where(eq(users.id, userId)).run();
}

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
			console.warn(`account ${user.id}: ${normalized} is taken, keeping ${user.email}`);
			return user;
		}
		throw error;
	}
}

export type GoogleResolution =
	| { ok: true; user: User; outcome: 'signed-in' | 'linked' | 'created' }
	| { ok: false; reason: 'closed' | 'claimed' };

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

export function deleteUser(db: Database, email: string): boolean {
	const removed = db
		.delete(users)
		.where(eq(users.email, normalizeEmail(email)))
		.returning({ id: users.id })
		.get();

	return removed !== undefined;
}

const DECOY_HASH = decoyHash();

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

export function revokeToken(db: Database, userId: string, tokenId: string): boolean {
	const removed = db
		.delete(authTokens)
		.where(and(eq(authTokens.id, tokenId), eq(authTokens.userId, userId)))
		.returning({ id: authTokens.id })
		.get();

	return removed !== undefined;
}

export function revokeOtherTokens(db: Database, userId: string, keep: string | null): number {
	const scope =
		keep === null
			? eq(authTokens.userId, userId)
			: and(eq(authTokens.userId, userId), ne(authTokens.id, keep));

	return db.delete(authTokens).where(scope).returning({ id: authTokens.id }).all().length;
}
