import { expect, test as base } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

import { plant } from '../scripts/seed/plant.ts';
import { insertUser, issueToken } from '../src/lib/server/auth/accounts.ts';
import { hashPassword } from '../src/lib/server/auth/password.ts';
import { SESSION_COOKIE, startWebSession } from '../src/lib/server/auth/session.ts';
import { createDatabase } from '../src/lib/server/db/client.ts';
import type { Database } from '../src/lib/server/db/client.ts';

import { APP_URL, DATABASE_PATH, WEB_URL } from './env.ts';
import { readStore } from './helpers.ts';

export { expect } from '@playwright/test';

export type Account = { id: string; email: string; password: string };

const PASSWORD = 'e2e-password';

type Fixtures = {
	seeded: boolean;
	google: boolean;
	account: Account;
	secondDevice: Page;
	token: string;
};

type WorkerFixtures = {
	db: Database;
	passwordHash: string;
};

// Both builds at once: the web build's session cookie, and the app build's server and device token.
async function signIn(db: Database, context: BrowserContext, account: Account): Promise<void> {
	const session = startWebSession(db, account.id, null);
	const device = issueToken(db, account.id, 'e2e device', 'device');

	await context.setStorageState({
		cookies: [
			{
				name: SESSION_COOKIE,
				value: session.token,
				domain: new URL(WEB_URL).hostname,
				path: '/',
				expires: -1,
				httpOnly: true,
				secure: false,
				sameSite: 'Lax'
			}
		],
		origins: [
			{
				origin: APP_URL,
				localStorage: [
					{ name: 'kilorep.server', value: WEB_URL },
					{ name: 'kilorep.token', value: device.token }
				]
			}
		]
	});
}

export const test = base.extend<Fixtures, WorkerFixtures>({
	db: [
		// oxlint-disable-next-line no-empty-pattern
		async ({}, use): Promise<void> => {
			const db = createDatabase(DATABASE_PATH);
			await use(db);
			db.$client.close();
		},
		{ scope: 'worker' }
	],

	passwordHash: [
		// oxlint-disable-next-line no-empty-pattern
		async ({}, use): Promise<void> => {
			await use(await hashPassword(PASSWORD));
		},
		{ scope: 'worker' }
	],

	seeded: [false, { option: true }],

	google: [false, { option: true }],

	account: async ({ db, passwordHash, seeded, google, context }, use) => {
		const email = `e2e-${crypto.randomUUID()}@kilorep.test`;
		const { id } = google
			? insertUser(db, email, null, `google-${crypto.randomUUID()}`)
			: insertUser(db, email, passwordHash, null);
		const account = { id, email, password: PASSWORD };

		const planted = seeded ? plant(db, id, Date.now()) : 0;

		await signIn(db, context, account);

		// On the device before the test starts, as on a phone that has held it for weeks: a record
		// or a plan opened by its address reads the store once and never redraws.
		if (planted > 0) {
			const primer = await context.newPage();
			await primer.goto('/train');
			await expect
				.poll(
					async () => {
						const { records } = await readStore(primer);

						return records.length;
					},
					{ timeout: 15_000 }
				)
				.toBeGreaterThanOrEqual(planted);
			await primer.close();
		}

		await use(account);
	},

	secondDevice: async ({ db, account, browser }, use) => {
		const context = await browser.newContext();
		await signIn(db, context, account);
		const page = await context.newPage();
		await use(page);
		await context.close();
	},

	token: async ({ db, account }, use) => {
		await use(issueToken(db, account.id, 'e2e', 'api').token);
	}
});
