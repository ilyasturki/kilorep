import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.ts';
import { logSet, startPlan, touch } from '../helpers.ts';

import { exerciseBlock, onDesk, setRow } from './support.ts';

test.use({ seeded: true });

// Arms has never been trained, so every set is typed and none is recalled.
const LOADS: Record<string, { kg: number; reps: number }> = {
	'Barbell Curl': { kg: 30, reps: 10 },
	'Preacher Curl': { kg: 25, reps: 12 },
	'Skull Crusher': { kg: 30, reps: 10 },
	'Overhead Triceps Extension': { kg: 25, reps: 12 }
};

async function markOptional(page: Page, name: string): Promise<void> {
	await page.goto('/plan/templates/seed-template-arms');

	const options = onDesk(page) ? `${name} options` : `Options for ${name}`;
	await page.getByRole('button', { name: options, exact: true }).click();

	const optional = page.getByRole('switch', { name: 'Optional' });
	await optional.click();
	await expect(optional).toBeChecked();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('main').getByText('Optional', { exact: true })).toBeVisible();
}

async function logExercise(page: Page, name: string): Promise<void> {
	const block = exerciseBlock(page, name);

	await touch(setRow(block, /^set 1 (?:active|pending)$/u));
	await logSet(page, LOADS[name]);
	await logSet(page);
	await logSet(page);
	await expect(block.getByRole('img', { name: 'set logged' })).toHaveCount(3);
}

async function expectFinishSays(page: Page, owed: string): Promise<void> {
	await page.getByRole('banner').getByRole('button', { name: 'FINISH', exact: true }).click();

	const ask = page.getByRole('alertdialog');
	await expect(ask).toContainText(owed);
	await page.keyboard.press('Escape');
	await expect(ask).toBeHidden();
}

test.beforeEach(async ({ page, account: _account }) => {
	await markOptional(page, 'Preacher Curl');
	await startPlan(page, 'Arms');
});

test('logging walks past an untouched optional exercise, and a tap on it takes it up', async ({
	page
}) => {
	const preacher = exerciseBlock(page, 'Preacher Curl');

	await expect(preacher.getByText('Optional', { exact: true })).toBeVisible();

	await logExercise(page, 'Barbell Curl');
	await expect(setRow(exerciseBlock(page, 'Skull Crusher'), 'set 1 active')).toBeVisible();
	await expect(setRow(preacher, 'set 1 pending')).toBeVisible();
	await expectFinishSays(page, '6 sets still owed.');

	await touch(setRow(preacher, 'set 1 pending'));
	await logSet(page, LOADS['Preacher Curl']);
	await expect(setRow(preacher, 'set 2 active')).toBeVisible();
	await expectFinishSays(page, '8 sets still owed.');
});

test('skipping it leaves nothing owed, and the record says it was skipped', async ({ page }) => {
	for (const name of ['Barbell Curl', 'Skull Crusher', 'Overhead Triceps Extension']) {
		await logExercise(page, name);
	}

	await page.getByRole('banner').getByRole('button', { name: 'FINISH', exact: true }).click();

	const ask = page.getByRole('alertdialog');
	await expect(ask).toContainText('Every set is logged.');
	await ask.getByRole('button', { name: 'Finish', exact: true }).click();
	await page.waitForURL(/\/history\/[^/]+$/u);

	await expect(
		page
			.locator('section', { has: page.getByRole('heading', { name: 'Preacher Curl' }) })
			.getByText('Skipped, optional')
	).toBeVisible();
	await expect(page.getByRole('main').getByText('Skipped, optional')).toHaveCount(1);
});
