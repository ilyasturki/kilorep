import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { eq } from 'drizzle-orm';

import {
	createUser,
	findUserByEmail,
	issueToken,
	resolveGoogleIdentity,
	verifyLogin
} from '$lib/server/auth/accounts';
import type { Credential } from '$lib/server/auth/session';
import { resolveCredential } from '$lib/server/auth/session';
import { resetLoginThrottle } from '$lib/server/auth/throttle';
import type { Database } from '$lib/server/db/client';
import { createDatabase } from '$lib/server/db/client';
import { runMigrations } from '$lib/server/db/migrate';
import type { AuthToken, User } from '$lib/server/db/schema';
import { authTokens } from '$lib/server/db/schema';

import { POST as changePassword } from './+server.ts';

const current = vi.hoisted(() => ({ db: null as Database | null }));

vi.mock('$lib/server/db/client', async (importOriginal) => {
	const actual = await importOriginal<{ createDatabase: typeof createDatabase }>();

	return { createDatabase: actual.createDatabase, getDatabase: (): Database | null => current.db };
});

const PASSWORD = 'correct horse battery';
const NEXT_PASSWORD = 'a brand new passphrase';
const FRESH_SIGN_IN_MS = 10 * 60 * 1000;

let db: Database;

beforeEach(() => {
	db = createDatabase(':memory:');
	runMigrations(db);
	current.db = db;
	resetLoginThrottle();
});

afterEach(() => {
	current.db = null;
	db.$client.close();
});

function signIn(user: User, kind: AuthToken['kind'], age = 0): Credential {
	const { token, record } = issueToken(db, user.id, kind, kind);

	db.update(authTokens)
		.set({ createdAt: new Date(record.createdAt.getTime() - age) })
		.where(eq(authTokens.id, record.id))
		.run();

	return resolveCredential(db, token)!;
}

function change(
	credential: Credential,
	body: Record<string, unknown>
): ReturnType<typeof changePassword> {
	const event = {
		request: new Request('http://localhost/api/auth/password', {
			method: 'POST',
			body: JSON.stringify(body)
		}),
		locals: { credential },
		getClientAddress: () => '127.0.0.1'
	} as unknown as Parameters<typeof changePassword>[0];

	return changePassword(event);
}

function googleOnly(): User {
	const created = resolveGoogleIdentity(db, { subject: 'sub-1', email: 'g@example.com' }, true);

	return created.ok ? created.user : expect.unreachable();
}

async function googleLinked(): Promise<User> {
	await createUser(db, 'lifter@example.com', PASSWORD);
	const linked = resolveGoogleIdentity(
		db,
		{ subject: 'sub-1', email: 'lifter@example.com' },
		false
	);

	return linked.ok ? linked.user : expect.unreachable();
}

describe('a Google-only account', () => {
	test('gets no first password from an API token, a device token or a stale web sign-in', async () => {
		const user = googleOnly();

		for (const credential of [
			signIn(user, 'api'),
			signIn(user, 'device'),
			signIn(user, 'web', FRESH_SIGN_IN_MS)
		]) {
			await expect(change(credential, { password: NEXT_PASSWORD })).rejects.toMatchObject({
				status: 403
			});
		}

		expect(findUserByEmail(db, 'g@example.com')!.passwordHash).toBeNull();
	});

	test('gets its first password from a fresh web sign-in', async () => {
		const user = googleOnly();

		const response = await change(signIn(user, 'web'), { password: NEXT_PASSWORD });

		expect(response.status).toBe(204);
		await expect(verifyLogin(db, 'g@example.com', NEXT_PASSWORD)).resolves.not.toBeNull();
	});
});

describe('a Google-linked account with a password', () => {
	test('is asked for it from an API token', async () => {
		const user = await googleLinked();
		const credential = signIn(user, 'api');

		await expect(change(credential, { password: NEXT_PASSWORD })).rejects.toMatchObject({
			status: 400
		});
		await expect(
			change(credential, { password: NEXT_PASSWORD, current: 'not the password' })
		).rejects.toMatchObject({ status: 403 });
		await expect(verifyLogin(db, 'lifter@example.com', PASSWORD)).resolves.not.toBeNull();

		const response = await change(credential, { password: NEXT_PASSWORD, current: PASSWORD });

		expect(response.status).toBe(204);
		await expect(verifyLogin(db, 'lifter@example.com', NEXT_PASSWORD)).resolves.not.toBeNull();
	});

	test('is asked for it again once the web sign-in is ten minutes old', async () => {
		const user = await googleLinked();
		const credential = signIn(user, 'web', FRESH_SIGN_IN_MS);

		await expect(change(credential, { password: NEXT_PASSWORD })).rejects.toMatchObject({
			status: 400
		});

		const response = await change(credential, { password: NEXT_PASSWORD, current: PASSWORD });

		expect(response.status).toBe(204);
	});

	test('is not asked for it within ten minutes of a web sign-in', async () => {
		const user = await googleLinked();

		const response = await change(signIn(user, 'web'), { password: NEXT_PASSWORD });

		expect(response.status).toBe(204);
		await expect(verifyLogin(db, 'lifter@example.com', NEXT_PASSWORD)).resolves.not.toBeNull();
	});
});
