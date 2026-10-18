import type { Locator, Page } from '@playwright/test';

import { WEB_URL } from '../env.ts';
import { expect, test } from '../fixtures.ts';
import { finish, logSet, readStore, startEmpty, syncNow, waitForSync } from '../helpers.ts';

function picker(page: Page): Locator {
	return page.getByRole('dialog', { name: /^(?:Add exercise|New exercise)$/u });
}

async function openPicker(page: Page): Promise<Locator> {
	await page
		.getByRole('button', { name: /^(?:Add exercise|Exercise)$/u })
		.last()
		.click();

	return picker(page);
}

function searchField(sheet: Locator): Locator {
	return sheet.getByRole('searchbox').or(sheet.getByRole('textbox')).first();
}

/** Typed into a session's picker, created from its "Create" row, and added to the session. */
async function createInSession(page: Page, typed: string): Promise<void> {
	const sheet = await openPicker(page);
	await searchField(sheet).fill(typed);
	await sheet.getByRole('button', { name: new RegExp(`^Create “${typed}”`, 'u') }).click();

	await sheet.getByRole('radio', { name: 'Barbell', exact: true }).click();
	await sheet.getByRole('radio', { name: 'Triceps', exact: true }).click();
	await sheet.getByRole('button', { name: 'Create', exact: true }).click();

	const commit = sheet.getByRole('button', { name: /^Add \d+ exercises?$/u });
	await expect(commit).toBeVisible();
	await commit.click();
	await expect(sheet).toBeHidden();
}

async function customIdOf(page: Page, name: string): Promise<string> {
	let id = '';
	await expect
		.poll(async () => {
			const { records } = await readStore(page);
			const custom = records.find(
				(record) =>
					record.kind === 'preference' &&
					JSON.stringify(record.payload).includes(`"name":"${name}"`)
			);
			id = custom === undefined ? '' : custom.id.replace(/^[^:]*:/u, '');

			return id;
		})
		.not.toBe('');

	return id;
}

test.describe('creating a custom exercise', () => {
	test.beforeEach(async ({ account: _signedIn, page }) => {
		await startEmpty(page);
	});

	test('a search with no answer offers "Create", and the form title-cases it', async ({ page }) => {
		const sheet = await openPicker(page);
		await searchField(sheet).fill('tate press');

		await sheet.getByRole('button', { name: /^Create “tate press”/u }).click();

		await expect(sheet.getByRole('textbox', { name: 'Name' })).toHaveValue('Tate Press');
	});

	test('Variant of fills the rest from the parent', async ({ page }) => {
		const sheet = await openPicker(page);
		await searchField(sheet).fill('tate press');
		await sheet.getByRole('button', { name: /^Create “tate press”/u }).click();

		await sheet.getByRole('button', { name: 'Variant of' }).click();
		await page.getByRole('option', { name: 'Bench Press', exact: true }).click();

		await expect(sheet.getByRole('radio', { name: 'Barbell', exact: true })).toBeChecked();
		await expect(sheet.getByRole('radio', { name: 'Total', exact: true })).toBeChecked();
		await expect(sheet.getByRole('radio', { name: 'Chest', exact: true }).first()).toBeChecked();
	});

	test('created, it is picked and lands in the session', async ({ page }) => {
		await createInSession(page, 'tate press');

		await expect(
			page.getByRole('main').getByRole('button', { name: 'Tate Press options' })
		).toBeVisible();
	});
});

test('a logged custom, deleted, leaves the lists and stays in its sessions with Restore', async ({
	account: _signedIn,
	page
}) => {
	await startEmpty(page);
	await createInSession(page, 'tate press');
	await logSet(page, { kg: 20, reps: 10 });
	const record = await finish(page);
	const id = await customIdOf(page, 'Tate Press');

	await page.goto(`/plan/exercises/${id}`);
	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	const ask = page.getByRole('alertdialog');
	await expect(ask).toContainText(
		'It leaves your lists. The sessions and plans that hold it keep it, under this name.'
	);
	await ask.getByRole('button', { name: 'Delete', exact: true }).click();

	await expect(page).toHaveURL(new RegExp(`/plan/exercises/${id}$`, 'u'));
	await expect(page.getByText(/^Deleted\. Its history stays here/u)).toBeVisible();
	const restore = page.getByRole('button', { name: 'Restore', exact: true });
	await expect(restore).toBeVisible();

	await page.goto(`/history/${record}`);
	await expect(
		page.getByRole('main').getByRole('heading', { name: 'Tate Press', exact: true })
	).toBeVisible();

	await page.goto('/plan/exercises');
	await page.getByRole('searchbox').or(page.getByRole('textbox')).first().fill('tate');
	await expect(page.getByRole('main').getByText('Nothing found')).toBeVisible();
	await expect(page.getByRole('main').getByText('Tate Press', { exact: true })).toHaveCount(0);

	await page.goto(`/plan/exercises/${id}`);
	await restore.click();
	await expect(page.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
	await expect(page.getByText(/^Deleted\./u)).toBeHidden();

	await page.goto('/plan/exercises');
	await page.getByRole('searchbox').or(page.getByRole('textbox')).first().fill('tate');
	await expect(page.getByRole('main').getByText('Tate Press', { exact: true })).toHaveCount(1);
});

test('a custom nothing names goes for good', async ({ account: _signedIn, page }) => {
	await page.goto('/plan/exercises');
	await page
		.getByRole('main')
		.getByRole('searchbox')
		.or(page.getByRole('main').getByRole('textbox'))
		.first()
		.fill('tate press');
	await page.getByRole('button', { name: /^Create “tate press”/u }).click();
	const sheet = page.getByRole('dialog', { name: 'New exercise' });
	await sheet.getByRole('radio', { name: 'Barbell', exact: true }).click();
	await sheet.getByRole('radio', { name: 'Triceps', exact: true }).click();
	await sheet.getByRole('button', { name: 'Create', exact: true }).click();
	await expect(page).toHaveURL(/\/plan\/exercises\/[^/]+$/u);
	await expect(
		page.getByRole('main').getByRole('button', { name: 'Delete', exact: true })
	).toBeVisible();

	await page.getByRole('button', { name: 'Delete', exact: true }).click();
	const ask = page.getByRole('alertdialog');
	await expect(ask).toContainText(
		'Nothing has been logged on it and no plan holds it, so it goes for good.'
	);
	await ask.getByRole('button', { name: 'Delete', exact: true }).click();

	await expect(page).toHaveURL(/\/plan\/exercises$/u);
});

async function callTool(
	token: string,
	name: string,
	args: Record<string, unknown>
): Promise<Record<string, unknown>> {
	const response = await fetch(`${WEB_URL}/api/mcp`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${token}`,
			'content-type': 'application/json',
			accept: 'application/json, text/event-stream'
		},
		body: JSON.stringify({
			jsonrpc: '2.0',
			id: 1,
			method: 'tools/call',
			params: { name, arguments: args }
		})
	});
	expect(response.ok).toBe(true);
	const body = (await response.json()) as { result: { content: { text: string }[] } };

	return JSON.parse(body.result.content[0].text) as Record<string, unknown>;
}

test('MCP finds a custom made in the app, marked custom, and logs a session on it', async ({
	token,
	page
}) => {
	await startEmpty(page);
	await createInSession(page, 'tate press');
	const id = await customIdOf(page, 'Tate Press');
	await waitForSync(page);

	const found = await callTool(token, 'search_exercises', { query: 'tate' });
	const rows = found.exercises as Record<string, unknown>[];
	expect(rows.find((row) => row.id === id)).toEqual(
		expect.objectContaining({ name: 'Tate Press', custom: true })
	);

	const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toLocaleDateString('sv-SE');
	const logged = await callTool(token, 'log_workout', {
		date: yesterday,
		exercises: [{ exerciseId: id, sets: [{ weight: 25, reps: 8 }] }]
	});
	expect(logged.error).toBeUndefined();

	await syncNow(page);
	await page.goto(`/plan/exercises/${id}`);
	await expect(
		page
			.getByRole('main')
			.locator('section', { has: page.getByRole('heading', { name: /^History/u }) })
			.getByRole('link')
	).toHaveCount(1);
});
