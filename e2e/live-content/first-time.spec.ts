import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.ts';
import type { Account } from '../fixtures.ts';
import type { Database } from '../../src/lib/server/db/client.ts';
import { addExercise, startEmpty } from '../helpers.ts';

import {
	exerciseAction,
	exerciseBlock,
	pastWorkout,
	plantWorkouts,
	setRow,
	tray
} from './support.ts';

// Last time stopped at three sets; the session before it reached five.
async function plantBench(page: Page, db: Database, account: Account): Promise<void> {
	await plantWorkouts(page, db, account.id, [
		pastWorkout('w5-older', 3 * 24 * 60, [
			{
				exerciseId: 'bench-press',
				sets: [
					{ weight: 70, reps: 8 },
					{ weight: 70, reps: 8 },
					{ weight: 70, reps: 8 },
					{ weight: 62.5, reps: 10 },
					{ weight: 60, reps: 12 }
				]
			}
		]),
		pastWorkout('w5-last', 24 * 60, [
			{
				exerciseId: 'bench-press',
				sets: [
					{ weight: 90, reps: 5 },
					{ weight: 90, reps: 5 },
					{ weight: 90, reps: 5 }
				]
			}
		])
	]);
}

async function sessionWithBenchAndCurl(page: Page): Promise<void> {
	await startEmpty(page);
	await addExercise(page, 'Bench Press');
	await addExercise(page, 'Barbell Curl');

	const bench = exerciseBlock(page, 'Bench Press');

	for (let count = 0; count < 3; count += 1) {
		await bench.getByRole('button', { name: 'Add set', exact: true }).click();
	}

	await expect(setRow(bench, 'set 6 active')).toBeVisible();
}

test(
	'a set beyond last time recalls the older session that reached it, or nothing',
	{ tag: '@phone' },
	async ({ page, db, account }) => {
		await plantBench(page, db, account);
		await sessionWithBenchAndCurl(page);

		const bench = exerciseBlock(page, 'Bench Press');
		const curl = exerciseBlock(page, 'Barbell Curl');
		const card = tray(page);
		const last = card.getByText('Last', { exact: true });

		await expect(last).toBeHidden();
		await expect(card.getByText('First time')).toBeHidden();

		await setRow(bench, 'set 1 pending').click();
		await expect(card).toContainText(/Last\s*90 × 5/u);

		await setRow(bench, 'set 4 pending').click();
		await expect(card).toContainText(/Last\s*62\.5 × 10/u);

		await setRow(bench, 'set 5 pending').click();
		await expect(card).toContainText(/Last\s*60 × 12/u);

		await setRow(bench, 'set 6 pending').click();
		await expect(last).toBeHidden();
		await expect(card.getByText('First time')).toBeHidden();

		await setRow(curl, 'set 1 pending').click();
		await expect(card).toContainText(/Last\s*First time/u);

		await exerciseAction(page, 'Bench Press', 'Add warmup');
		await expect(setRow(bench, 'warmup active')).toBeVisible();
		await expect(card.getByText('Warmup', { exact: true })).toBeVisible();
		await expect(last).toBeHidden();
		await expect(card.getByText('First time')).toBeHidden();

		await exerciseAction(page, 'Barbell Curl', 'Add warmup');
		await expect(setRow(curl, 'warmup active')).toBeVisible();
		await expect(card.getByText('Warmup', { exact: true })).toBeVisible();
		await expect(last).toBeHidden();
		await expect(card.getByText('First time')).toBeHidden();
	}
);

test(
	'the ledger recalls the older session past last time, and a blank beyond it',
	{ tag: '@desk' },
	async ({ page, db, account }) => {
		await plantBench(page, db, account);
		await sessionWithBenchAndCurl(page);

		const bench = exerciseBlock(page, 'Bench Press');
		const curl = exerciseBlock(page, 'Barbell Curl');

		await expect(setRow(bench, 'set 1 pending')).toContainText('90 × 5');
		await expect(setRow(bench, 'set 4 pending')).toContainText('62.5 × 10');
		await expect(setRow(bench, 'set 5 pending')).toContainText('60 × 12');
		await expect(setRow(bench, 'set 6 active')).toContainText('—');
		await expect(setRow(curl, 'set 1 pending')).toContainText('—');

		await exerciseAction(page, 'Bench Press', 'Add warmup');
		await expect(setRow(bench, 'warmup active')).toContainText('50 % of 90 kg');

		await expect(page.getByRole('main').getByText('First time')).toHaveCount(0);
	}
);
