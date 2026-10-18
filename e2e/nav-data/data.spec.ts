import { readFile } from 'node:fs/promises';

import type { Download, Locator, Page } from '@playwright/test';

import { localDateOf } from '../../src/lib/domain/bodyweight.ts';
import { APP_URL } from '../env.ts';
import { expect, test } from '../fixtures.ts';

type Exported = {
	kind: string;
	records: { id: string; kind: string; payload: Record<string, unknown> }[];
};

const DAY = /\d{4}-\d{2}-\d{2}/u.source;

async function text(download: Download): Promise<string> {
	return readFile(await download.path(), 'utf8');
}

function dataRow(page: Page, title: string): Locator {
	return page.getByRole('main').getByRole('button', { name: new RegExp(`^${title}`, 'u') });
}

async function exportJson(page: Page): Promise<Download> {
	await page.goto('/settings');
	const downloaded = page.waitForEvent('download');
	await dataRow(page, 'Export JSON').click();

	return downloaded;
}

async function importFile(page: Page, file: string): Promise<void> {
	const chooser = page.waitForEvent('filechooser');
	await dataRow(page, 'Import a backup').click();
	const picker = await chooser;
	await picker.setFiles(file);
}

function counted(n: number, one: string, many: string): string {
	return `${n} ${n === 1 ? one : many}`;
}

function shownDay(day: string): string {
	const [year, month, date] = day.split('-').map(Number);

	return new Intl.DateTimeFormat('en-US', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	}).format(new Date(year, month - 1, date));
}

test.use({ seeded: true });

test('Export JSON hands over one dated backup of everything', async ({ page, account }) => {
	void account;
	const download = await exportJson(page);

	expect(download.suggestedFilename()).toMatch(new RegExp(`^kilorep-${DAY}\\.json$`, 'u'));
	const backup = JSON.parse(await text(download)) as Exported;
	const kinds = backup.records.map(({ kind }) => kind);

	expect(backup.kind).toBe('kilorep-backup');
	expect(kinds.filter((kind) => kind === 'workout')).toHaveLength(25);
	expect(kinds.filter((kind) => kind === 'template')).toHaveLength(4);
	expect(kinds).toContain('bodyweight');
});

test('Export CSV hands over two files, sets and body weight', async ({ page, account }) => {
	void account;
	await page.goto('/settings');

	const downloads: Download[] = [];
	page.on('download', (download) => downloads.push(download));
	await dataRow(page, 'Export CSV').click();
	await expect.poll(() => downloads.length).toBe(2);

	const lines = async (name: string): Promise<string[]> => {
		const pattern = new RegExp(`^kilorep-${name}-${DAY}\\.csv$`, 'u');
		const found = downloads.filter((download) => pattern.test(download.suggestedFilename()));
		expect(found).toHaveLength(1);
		const content = await text(found[0]);

		return content.trim().split(/\r?\n/u);
	};

	const sets = await lines('sets');
	expect(sets[0].split(',').slice(0, 13)).toEqual([
		'date',
		'workout',
		'exercise',
		'set',
		'type',
		'weight_kg',
		'load_mode',
		'reps',
		'rpe',
		'grip',
		'arms',
		'completed',
		'load_kg'
	]);
	expect(sets.length).toBeGreaterThan(25);

	const weights = await lines('bodyweight');
	expect(weights[0]).toBe('date,kg');
	expect(weights.length).toBeGreaterThan(1);
});

test('importing a backup the device already holds brings nothing new', async ({
	page,
	account
}) => {
	void account;
	const download = await exportJson(page);

	await importFile(page, await download.path());
	const sheet = page.getByRole('dialog', { name: 'Import this backup?' });
	await expect(sheet.getByText('25 workouts')).toBeVisible();
	await sheet.getByRole('button', { name: 'Import', exact: true }).click();

	await expect(
		page.getByText('Nothing new: this device already holds everything in the backup.')
	).toBeVisible();
});

test('a backup restores whole into an emptied app', async ({ page, account, browser }) => {
	void account;
	const download = await exportJson(page);
	const backup = JSON.parse(await text(download)) as Exported;

	const of = (kind: string): Exported['records'] =>
		backup.records.filter((record) => record.kind === kind);
	const days = [
		...of('workout').map(({ payload }) => localDateOf(new Date(Number(payload.startedAt)))),
		...of('bodyweight').map(({ payload }) => String(payload.date))
	].toSorted();

	const emptied = await browser.newContext();
	const phone = await emptied.newPage();
	await phone.goto(`${APP_URL}/settings`);
	await importFile(phone, await download.path());

	const sheet = phone.getByRole('dialog', { name: 'Import this backup?' });
	await expect(sheet).toContainText(`${shownDay(days[0])} – ${shownDay(days.at(-1) ?? '')}`);
	for (const line of [
		counted(of('workout').length, 'workout', 'workouts'),
		counted(of('template').length, 'plan', 'plans'),
		counted(of('bodyweight').length, 'weigh-in', 'weigh-ins')
	]) {
		await expect(sheet.getByText(line, { exact: true })).toBeVisible();
	}
	await sheet.getByRole('button', { name: 'Import', exact: true }).click();

	await expect(phone.getByText(`Imported ${backup.records.length} records.`)).toBeVisible();

	await phone.goto(`${APP_URL}/history`);
	await expect(
		phone.getByRole('main').getByRole('link', { name: /^\S.* \d+ sets? /u })
	).toHaveCount(of('workout').length);

	const [latest] = of('bodyweight')
		.map(({ payload }) => payload)
		.toSorted((a, b) => String(b.date).localeCompare(String(a.date)));
	await phone.goto(`${APP_URL}/bodyweight`);
	await expect(phone.getByRole('main').getByText(String(latest.kg)).first()).toBeVisible();

	await phone.goto(`${APP_URL}/progress`);
	await expect(phone.getByRole('link', { name: /^Training frequency /u })).toBeVisible();

	await emptied.close();
});
