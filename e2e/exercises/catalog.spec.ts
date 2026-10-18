import type { Locator, Page } from '@playwright/test';

import { catalogById } from '../../src/lib/catalog.ts';
import { expect, test } from '../fixtures.ts';
import { startEmpty } from '../helpers.ts';
import { finishedSession, plantRecords } from '../plant.ts';

function history(page: Page): Locator {
	return page
		.getByRole('main')
		.locator('section', { has: page.getByRole('heading', { name: /^History/u }) })
		.getByRole('link');
}

async function expectChips(page: Page, names: string[]): Promise<void> {
	await expect(page.getByRole('main').getByRole('radio')).toHaveText(names);
}

async function narrowTo(page: Page, chip: string): Promise<void> {
	await page.getByRole('radio', { name: chip, exact: true }).click();
	await expect(page.getByRole('radio', { name: chip, exact: true })).toBeChecked();
}

test.describe('grips on history logged before the catalog changed', () => {
	test('Seated Cable Row: old rope sets under Rope, old straight bar under Wide Bar', async ({
		db,
		account,
		page
	}) => {
		await plantRecords(db, account.id, page, [
			finishedSession(10, [
				{ exerciseId: 'seated-cable-row', grip: 'rope', sets: [{ kg: 41, reps: 10, grip: 'rope' }] }
			]),
			finishedSession(6, [
				{
					exerciseId: 'seated-cable-row',
					grip: 'straight',
					sets: [{ kg: 46, reps: 10, grip: 'straight' }]
				}
			]),
			finishedSession(2, [
				{ exerciseId: 'seated-cable-row', sets: [{ kg: 51, reps: 10, grip: 'v-bar' }] }
			])
		]);
		await page.goto('/plan/exercises/seated-cable-row');

		await expectChips(page, ['All', 'V-Bar', 'Wide Bar', 'Rope']);

		const rows = history(page);
		await expect(rows).toHaveCount(3);
		await expect(rows.nth(0)).toContainText(/ · V-Bar.*\b51\b/u);
		await expect(rows.nth(1)).toContainText(/ · Wide Bar.*\b46\b/u);
		await expect(rows.nth(2)).toContainText(/ · Rope.*\b41\b/u);

		await narrowTo(page, 'Rope');
		await expect(rows).toHaveCount(1);
		await expect(rows.first()).toContainText(/\b41\b/u);

		await narrowTo(page, 'Wide Bar');
		await expect(rows).toHaveCount(1);
		await expect(rows.first()).toContainText(/\b46\b/u);

		await narrowTo(page, 'V-Bar');
		await expect(rows).toHaveCount(1);
		await expect(rows.first()).toContainText(/\b51\b/u);
	});

	test('Lat Pulldown: "Close" history, and the old close-grip entry, under Neutral', async ({
		db,
		account,
		page
	}) => {
		await plantRecords(db, account.id, page, [
			finishedSession(9, [{ exerciseId: 'close-grip-lat-pulldown', sets: [{ kg: 47, reps: 10 }] }]),
			finishedSession(5, [
				{ exerciseId: 'lat-pulldown', grip: 'close', sets: [{ kg: 52, reps: 10, grip: 'close' }] }
			]),
			finishedSession(1, [
				{ exerciseId: 'lat-pulldown', sets: [{ kg: 61, reps: 10, grip: 'wide' }] }
			])
		]);
		await page.goto('/plan/exercises/lat-pulldown');

		await expectChips(page, ['All', 'Pronated', 'Neutral', 'Supinated']);

		const rows = history(page);
		await expect(rows).toHaveCount(3);
		await expect(rows.nth(0)).toContainText(/ · Pronated.*\b61\b/u);
		await expect(rows.nth(1)).toContainText(/ · Neutral.*\b52\b/u);
		await expect(rows.nth(2)).toContainText(/ · Neutral.*\b47\b/u);

		await narrowTo(page, 'Neutral');
		await expect(rows).toHaveCount(2);

		await narrowTo(page, 'Pronated');
		await expect(rows).toHaveCount(1);
	});

	test('Pull-Up: chin-ups under Supinated', async ({ db, account, page }) => {
		await plantRecords(db, account.id, page, [
			finishedSession(4, [{ exerciseId: 'chin-up', sets: [{ kg: 0, reps: 9 }] }]),
			finishedSession(2, [{ exerciseId: 'pull-up', sets: [{ kg: 0, reps: 7, grip: 'overhand' }] }])
		]);
		await page.goto('/plan/exercises/pull-up');

		await expectChips(page, ['All', 'Pronated', 'Supinated', 'Neutral']);

		const rows = history(page);
		await expect(rows).toHaveCount(2);
		await expect(rows.nth(1)).toContainText(/ · Supinated.*\b9 reps\b/u);

		await narrowTo(page, 'Supinated');
		await expect(rows).toHaveCount(1);
		await expect(rows.first()).toContainText(/\b9 reps\b/u);
	});
});

test.describe('families', () => {
	test.beforeEach(async ({ account: _signedIn, page }) => {
		await page.goto('/plan/exercises');
	});

	for (const [parent, variants] of [
		['bench-press', ['dumbbell-bench-press', 'incline-dumbbell-press', 'machine-bench-press']],
		['overhead-press', ['seated-dumbbell-press', 'arnold-press']],
		['squat', ['hack-squat']],
		['dumbbell-curl', ['hammer-curl']],
		['dumbbell-fly', ['cable-fly', 'pec-deck']],
		['preacher-curl', ['machine-curl']],
		['leg-press', ['horizontal-leg-press', 'single-leg-press']]
	] as const) {
		const names = variants.map((id) => catalogById[id].name);

		test(`${catalogById[parent].name} holds ${names.join(', ')}`, async ({ page }) => {
			await page.goto(`/plan/exercises/${parent}`);
			const listed = page
				.getByRole('main')
				.locator('section', { has: page.getByRole('heading', { name: 'Variants' }) })
				.getByRole('link');

			for (const name of names) {
				await expect(listed.getByText(name, { exact: true })).toHaveCount(1);
			}
		});
	}

	test('Leg Press is a family of its own, not a squat', async ({ page }) => {
		await page.goto('/plan/exercises/squat');
		const listed = page
			.getByRole('main')
			.locator('section', { has: page.getByRole('heading', { name: 'Variants' }) })
			.getByRole('link');
		await expect(listed.first()).toBeVisible();
		await expect(listed.filter({ hasText: /Leg Press/u })).toHaveCount(0);
	});
});

test('"bench machine" and "press machine" find Machine Bench Press', async ({
	account: _signedIn,
	page
}) => {
	await startEmpty(page);
	await page
		.getByRole('button', { name: /^(?:Add exercise|Exercise)$/u })
		.last()
		.click();
	const picker = page.getByRole('dialog', { name: 'Add exercise' });
	const field = picker.getByRole('searchbox').or(picker.getByRole('textbox'));
	const found = picker.getByRole('button', { name: /^Machine Bench Press /u });

	await field.fill('bench machine');
	await expect(found).toBeVisible();

	await field.fill('press machine');
	await expect(found).toBeVisible();
});

test('hip adduction counts as Quads', async ({ db, account, page }) => {
	await plantRecords(db, account.id, page, [
		finishedSession(2, [
			{
				exerciseId: 'hip-adduction',
				sets: [
					{ kg: 40, reps: 12 },
					{ kg: 40, reps: 12 },
					{ kg: 40, reps: 12 }
				]
			}
		])
	]);
	await page.goto('/progress');

	const tally = page
		.getByRole('main')
		.locator('section', { has: page.getByRole('heading', { name: 'Sets per muscle' }) });
	const row = (muscle: string): Locator =>
		tally.locator('div', { has: page.getByText(muscle, { exact: true }) }).last();

	await expect(row('Quads')).toHaveText(/^Quads\s*3$/u);
	await expect(tally.getByText('Glutes', { exact: true })).toHaveCount(0);
});
