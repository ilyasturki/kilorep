import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures.ts';
import type { Account } from '../fixtures.ts';
import type { Database } from '../../src/lib/server/db/client.ts';
import { addExercise, logSet, startEmpty, startPlan } from '../helpers.ts';

import {
	exerciseBlock,
	onDesk,
	pastWorkout,
	plantWorkouts,
	setRow,
	tapOn,
	trayLast
} from './support.ts';

const UNDERHAND = 'underhand';

async function plantSupinated(page: Page, db: Database, account: Account): Promise<void> {
	await plantWorkouts(page, db, account.id, [
		pastWorkout('w11-supinated', 60, [
			{
				exerciseId: 'pull-up',
				grip: UNDERHAND,
				sets: [
					{ weight: 0, reps: 8, grip: UNDERHAND },
					{ weight: 5, reps: 8, grip: UNDERHAND },
					{ weight: 0, reps: 6, grip: UNDERHAND }
				]
			}
		])
	]);
}

async function pickGrip(page: Page, grip: string): Promise<void> {
	await page.getByRole('button', { name: 'Pull-Up options', exact: true }).click();
	await page.getByRole('radio', { name: grip, exact: true }).click();
	await expect(page.getByRole('radio', { name: grip, exact: true })).toBeHidden();
}

// The tray on a phone, the row's Last time column on the desk.
async function recallOf(page: Page, mark: string | RegExp): Promise<Locator> {
	const row = setRow(exerciseBlock(page, 'Pull-Up'), mark);

	if (onDesk(page)) {
		return row.locator('xpath=./span[3]');
	}

	await tapOn(row);

	return trayLast(page);
}

test.describe(() => {
	test.use({ seeded: true });

	test('last time on another grip names it, and today on the same grip names none', async ({
		page,
		db,
		account
	}) => {
		await plantSupinated(page, db, account);
		await startPlan(page, 'Pull Day');

		await expect(await recallOf(page, 'set 1 pending')).toHaveText('8 reps · Supinated');
		await expect(await recallOf(page, 'set 2 pending')).toHaveText('+5 × 8 · Supinated');

		await pickGrip(page, 'Supinated');
		await expect(await recallOf(page, 'set 3 pending')).toHaveText('6 reps');

		await pickGrip(page, 'Pronated');
		await expect(await recallOf(page, /^set 3 (?:pending|active)$/u)).toHaveText(
			'6 reps · Supinated'
		);
	});

	test('body-weight rows read the reps alone, or what was added', async ({ page, db, account }) => {
		await plantSupinated(page, db, account);
		await startPlan(page, 'Pull Day');

		const pullUp = exerciseBlock(page, 'Pull-Up');
		await tapOn(setRow(pullUp, 'set 1 pending'));
		await logSet(page);
		// The carry from set 1 outranks last time's +5 here.
		await logSet(page, { kg: 5 });

		const logged = pullUp.getByRole('img', { name: 'set logged', exact: true });
		await expect(logged).toHaveCount(2);

		if (onDesk(page)) {
			const rows = logged.locator('xpath=../..');
			const load = (at: number): Locator => rows.nth(at).locator('xpath=./span[4]');
			const reps = (at: number): Locator => rows.nth(at).locator('xpath=./span[5]');

			await expect(load(0)).toHaveText('');
			await expect(reps(0)).toHaveText('8');
			await expect(load(1)).toHaveText(/^\s*\+5\s*kg\s*$/u);
			await expect(reps(1)).toHaveText('8');

			return;
		}

		const rows = pullUp
			.getByRole('button')
			.filter({ has: page.getByRole('img', { name: 'set logged' }) });

		await expect(rows.nth(0)).toHaveText(/^\s*8\s*reps\s*Logged\s*$/u);
		await expect(rows.nth(1)).toHaveText(/^\s*\+5\s*kg\s*×\s*8\s*Logged\s*$/u);
	});
});

test(
	'the reps prefill from last time across grips',
	{ tag: '@phone' },
	async ({ page, db, account }) => {
		await plantSupinated(page, db, account);
		await startEmpty(page);
		await addExercise(page, 'Pull-Up');

		const reps = page.getByRole('textbox', { name: 'reps' });

		await expect(trayLast(page)).toHaveText('8 reps');
		await expect(reps).toHaveValue('8');

		await pickGrip(page, 'Pronated');
		await expect(trayLast(page)).toHaveText('8 reps · Supinated');
		await expect(reps).toHaveValue('8');
	}
);
