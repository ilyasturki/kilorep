import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures.ts';
import { addExercise, startEmpty } from '../helpers.ts';

import {
	exerciseAction,
	exerciseBlock,
	onDesk,
	pastWorkout,
	plantWorkouts,
	setRow,
	tray
} from './support.ts';

const WARMUP = /^warmup (?:set|active)$/u;

type Rung = { kg: string; reps: string; named: string };

async function expectRungs(page: Page, block: Locator, rungs: Rung[]): Promise<void> {
	const rows = setRow(block, WARMUP);

	await expect(rows).toHaveCount(rungs.length);

	for (const [at, { kg, reps, named }] of rungs.entries()) {
		const row = rows.nth(at);

		if (onDesk(page)) {
			await expect(row.locator('xpath=./span[3]')).toHaveText(named);
			// The selected row wraps its numbers in − and + steppers.
			await expect(row.locator('xpath=./span[4]')).toHaveText(
				new RegExp(String.raw`^[\s−]*${kg.replace('.', String.raw`\.`)}\s*kg[\s+]*$`, 'u')
			);
			await expect(row.locator('xpath=./span[5]')).toHaveText(
				new RegExp(String.raw`^[\s−]*${reps}[\s+]*$`, 'u')
			);
		} else {
			await expect(row).toContainText(
				new RegExp(String.raw`${kg.replace('.', String.raw`\.`)}\s*kg\s*×\s*${reps}`, 'u')
			);
		}
	}
}

async function addWarmups(page: Page, name: string, count: number): Promise<void> {
	const warmups = setRow(exerciseBlock(page, name), WARMUP);
	const held = await warmups.count();

	for (let added = 1; added <= count; added += 1) {
		await exerciseAction(page, name, 'Add warmup');
		await expect(warmups).toHaveCount(held + added);
	}
}

test.beforeEach(async ({ page, db, account }) => {
	await plantWorkouts(page, db, account.id, [
		pastWorkout('w12-last', 24 * 60, [
			{
				exerciseId: 'bench-press',
				sets: [
					{ weight: 87.5, reps: 5 },
					{ weight: 87.5, reps: 5 }
				]
			},
			{
				exerciseId: 'incline-dumbbell-press',
				sets: [
					{ weight: 17, reps: 10 },
					{ weight: 17, reps: 10 }
				]
			}
		])
	]);
	await startEmpty(page);
	await addExercise(page, 'Bench Press');
	await addExercise(page, 'Incline DB Press');
});

test('a barbell ramp climbs to 85 % rounded down to 2.5 kg, and a fourth is the empty bar', async ({
	page
}) => {
	const bench = exerciseBlock(page, 'Bench Press');

	await addWarmups(page, 'Bench Press', 3);
	await expectRungs(page, bench, [
		{ kg: '42.5', reps: '8', named: '50 % of 87.5 kg' },
		{ kg: '60', reps: '5', named: '70 % of 87.5 kg' },
		{ kg: '72.5', reps: '3', named: '85 % of 87.5 kg' }
	]);

	await addWarmups(page, 'Bench Press', 1);
	await expectRungs(page, bench, [
		{ kg: '20', reps: '10', named: 'Empty bar' },
		{ kg: '42.5', reps: '8', named: '50 % of 87.5 kg' },
		{ kg: '60', reps: '5', named: '70 % of 87.5 kg' },
		{ kg: '72.5', reps: '3', named: '85 % of 87.5 kg' }
	]);

	if (!onDesk(page)) {
		await setRow(bench, WARMUP).nth(1).click();
		await expect(tray(page)).toContainText(/Warmup\s*50 % of 87\.5 kg/u);
	}
});

test('a dumbbell ramp rounds down by 1 kg under 10 and 2 kg above', async ({ page }) => {
	const press = exerciseBlock(page, 'Incline DB Press');

	await addWarmups(page, 'Incline DB Press', 4);
	await expectRungs(page, press, [
		{ kg: '5', reps: '10', named: '30 % of 17 kg' },
		{ kg: '8', reps: '8', named: '50 % of 17 kg' },
		{ kg: '10', reps: '5', named: '70 % of 17 kg' },
		{ kg: '14', reps: '3', named: '85 % of 17 kg' }
	]);
});
