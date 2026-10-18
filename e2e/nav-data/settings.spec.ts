import type { APIRequestContext, Page } from '@playwright/test';

import pkg from '../../package.json' with { type: 'json' };
import { records } from '../../src/lib/server/db/schema.ts';
import { claimSeq } from '../../src/lib/server/db/seq.ts';
import { APP_URL, WEB_URL } from '../env.ts';
import { expect, test } from '../fixtures.ts';
import { syncNow } from '../helpers.ts';

type ToolReply = { result?: { content: { text: string }[]; isError?: boolean }; error?: unknown };

async function mcp(
	request: APIRequestContext,
	token: string,
	method: string,
	params: unknown
): Promise<{ status: number; body: ToolReply }> {
	const response = await request.post(`${WEB_URL}/api/mcp`, {
		headers: {
			authorization: `Bearer ${token}`,
			accept: 'application/json, text/event-stream'
		},
		data: { jsonrpc: '2.0', id: 1, method, params }
	});
	const body = response.ok() ? ((await response.json()) as ToolReply) : {};

	return { status: response.status(), body };
}

async function callTool<T>(
	request: APIRequestContext,
	token: string,
	name: string,
	args: unknown
): Promise<T> {
	const { status, body } = await mcp(request, token, 'tools/call', { name, arguments: args });
	expect(status).toBe(200);
	expect(body.error).toBeUndefined();
	if (body.result === undefined) {
		throw new Error(`${name} answered nothing`);
	}

	return JSON.parse(body.result.content[0].text) as T;
}

function row(page: Page, title: RegExp | string): ReturnType<Page['getByRole']> {
	return page.getByRole('main').getByRole('button', {
		name: typeof title === 'string' ? new RegExp(`^${title}`, 'u') : title
	});
}

test('a minted token comes with a Claude Code line that reaches MCP', async ({
	page,
	account,
	request
}) => {
	void account;
	await page.goto('/settings');
	await page.getByRole('button', { name: 'NEW', exact: true }).click();
	const sheet = page.getByRole('dialog', { name: 'New API token' });
	await sheet.getByRole('textbox', { name: 'Label' }).fill('Claude on the desk');
	await sheet.getByRole('button', { name: 'Create token' }).click();

	const line = page.getByText(/^claude mcp add /u);
	await expect(line).toHaveText(
		new RegExp(
			`^claude mcp add --transport http kilorep ${WEB_URL}/api/mcp --header "Authorization: Bearer kr_[\\w-]+"$`,
			'u'
		)
	);
	const shown = (await line.textContent()) ?? '';
	const [secret] = /kr_[\w-]+/u.exec(shown) ?? [''];

	const json = JSON.parse((await page.locator('pre').textContent()) ?? '{}') as {
		mcpServers: { kilorep: { url: string; headers: { Authorization: string } } };
	};
	expect(json.mcpServers.kilorep).toMatchObject({
		url: `${WEB_URL}/api/mcp`,
		headers: { Authorization: `Bearer ${secret}` }
	});

	const { status } = await mcp(request, secret, 'initialize', {
		protocolVersion: '2025-06-18',
		capabilities: {},
		clientInfo: { name: 'e2e', version: '0' }
	});
	expect(status).toBe(200);

	const listed = await mcp(request, secret, 'tools/list', {});
	expect(JSON.stringify(listed.body)).toContain('"search_exercises"');

	await page.reload();
	await expect(row(page, 'Claude on the desk')).toBeVisible();
});

for (const [build, baseURL] of [
	['web', WEB_URL],
	['app', APP_URL]
] as const) {
	test.describe(`${build} build`, () => {
		test.use({ baseURL });

		test('About states the app version and the server’s', async ({ page, account }) => {
			void account;
			await page.goto('/settings');
			const item = (text: string): ReturnType<Page['getByRole']> =>
				page.getByRole('main').getByRole('listitem').filter({ hasText: text });

			await expect(item(`Version ${pkg.version}`)).toBeVisible();
			await expect(item(`Server ${pkg.version}`)).toBeVisible();
		});
	});
}

test.describe('app build', () => {
	test.use({ baseURL: APP_URL });

	test('a token renamed from the phone keeps its new name', async ({ page, token }) => {
		void token;
		await page.goto('/settings');
		await row(page, /^e2e api /u).click();

		const sheet = page.getByRole('dialog', { name: 'e2e' });
		await sheet.getByRole('textbox', { name: 'Label' }).fill('Laptop agent');
		await sheet.getByRole('button', { name: 'Rename' }).click();

		await expect(row(page, /^Laptop agent api /u)).toBeVisible();
		await page.reload();
		await expect(row(page, /^Laptop agent api /u)).toBeVisible();
		await expect(row(page, /^e2e api /u)).toBeHidden();
	});
});

test('MCP finds a custom exercise and logs a session with it', async ({
	page,
	account,
	db,
	token,
	request
}) => {
	db.transaction((tx) => {
		const values = {
			userId: account.id,
			id: 'exercise:custom_quokka01',
			kind: 'preference' as const,
			seq: claimSeq(tx, account.id),
			updatedAt: Date.now(),
			deletedAt: null,
			payload: {
				name: 'Quokka Press',
				equipment: 'Barbell',
				loadMode: 'total',
				muscles: { primary: 'Shoulders', secondary: ['Triceps'] },
				variantOf: null,
				archivedAt: null
			}
		};
		tx.insert(records).values(values).run();
	});

	const found = await callTool<{ exercises: { id: string; custom?: boolean }[] }>(
		request,
		token,
		'search_exercises',
		{ query: 'quokka' }
	);
	expect(found.exercises).toEqual([
		expect.objectContaining({ id: 'custom_quokka01', custom: true })
	]);

	const today = new Date();
	const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
	const wrote = await callTool<{ error?: string; totals: { completedSets: number } }>(
		request,
		token,
		'log_workout',
		{ date, exercises: [{ exerciseId: 'custom_quokka01', sets: [{ weight: 40, reps: 10 }] }] }
	);
	expect(wrote.error).toBeUndefined();
	expect(wrote.totals.completedSets).toBe(1);

	await page.goto('/history');
	await expect(
		page.getByRole('main').getByRole('link', { name: /^Quokka Press .*1 set/u })
	).toBeVisible();
});

for (const google of [false, true]) {
	test.describe(google ? 'a Google-only account' : 'a password account', () => {
		test.use({ google });

		test('Sign out other devices keeps this one and signs the phone out at its next sync', async ({
			page,
			secondDevice,
			token,
			request
		}) => {
			await secondDevice.goto(`${APP_URL}/settings`);
			await expect(secondDevice.getByText('Synced', { exact: false }).first()).toBeVisible();

			await page.goto('/settings');
			await row(page, 'Sign out other devices').click();
			await page
				.getByRole('alertdialog')
				.getByRole('button', { name: 'Sign out', exact: true })
				.click();
			await expect(page.getByText('Every other device signed out.')).toBeVisible();

			await page.reload();
			await expect(row(page, 'Sign out other devices')).toBeVisible();
			await expect(page).toHaveURL(/\/settings$/u);

			const refused = await mcp(request, token, 'tools/list', {});
			expect(refused.status).toBe(401);

			await syncNow(secondDevice);
			await expect(secondDevice.getByText(`${WEB_URL} Not signed in`)).toBeVisible();
			await expect(
				secondDevice.getByRole('main').getByRole('button', { name: 'Sign in', exact: true })
			).toBeVisible();
			await expect(row(secondDevice, 'Sign out other devices')).toBeHidden();
		});
	});
}
