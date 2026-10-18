import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures.ts';
import { addExercise, startEmpty } from '../helpers.ts';

import { drag, exerciseAction, exerciseBlock, longPress, onDesk, setRow } from './support.ts';

async function top(target: Locator): Promise<number> {
	const box = await target.boundingBox();

	if (box === null) {
		throw new Error('nothing there to measure');
	}

	return box.y;
}

function overlays(page: Page): Locator {
	return page.getByRole('dialog').or(page.getByRole('menu'));
}

// A long-press on a phone; the row's ⋯ on a desk, where nothing holds.
async function openSetSheet(page: Page, row: Locator, title: string): Promise<Locator> {
	const sheet = overlays(page).filter({ has: page.getByRole('radio', { name: 'Warmup' }) });

	if (onDesk(page)) {
		await row.getByRole('button', { name: 'Set options' }).click();
		await expect(sheet).toBeVisible();
	} else {
		await longPress(page, row, sheet);
	}

	await expect(sheet).toHaveAccessibleName(title);

	return sheet;
}

// Gone from the tree, not just closing: a sheet sliding out still answers to its role.
async function closeSheets(page: Page): Promise<void> {
	await page.keyboard.press('Escape');
	await expect(overlays(page)).toHaveCount(0);
}

// `account` signs the page in; nothing else here needs it.
test.beforeEach(async ({ page, account: _account }) => {
	await startEmpty(page);
	await addExercise(page, 'Bench Press');
});

test('a set sheet opens on its type, and Warmup on set 1 renumbers the rest until undone', async ({
	page
}) => {
	const bench = exerciseBlock(page, 'Bench Press');
	const marks = bench.getByRole('img');

	await expect(marks).toHaveText(['1', '2', '3']);

	let sheet = await openSetSheet(page, setRow(bench, /^set 1 (?:active|pending)$/u), 'Set 1');
	const types = sheet.getByRole('radio');

	await expect(types.first()).toHaveAccessibleName('Warmup');
	await expect(types.nth(1)).toHaveAccessibleName('Drop');
	await expect(types.nth(2)).toHaveAccessibleName('Failure');

	const typeRow = await top(types.first());
	const acts = sheet
		.getByRole('button', { name: /set$/u })
		.or(sheet.getByRole('menuitem', { name: /set$/u }));

	await expect(acts.first()).toBeVisible();
	for (const act of await acts.all()) {
		expect(await top(act)).toBeGreaterThan(typeRow);
	}

	await sheet.getByRole('radio', { name: 'Warmup' }).click();
	await closeSheets(page);

	await expect(marks).toHaveText(['W', '1', '2']);

	sheet = await openSetSheet(page, setRow(bench, /^warmup /u), 'Warmup');
	await expect(sheet.getByRole('radio', { name: 'Warmup' })).toBeChecked();
	await sheet.getByRole('radio', { name: 'Warmup' }).click();
	await expect(sheet).toHaveAccessibleName('Set 1');
	await expect(sheet.getByRole('radio', { name: 'Warmup' })).not.toBeChecked();
	await closeSheets(page);

	await expect(marks).toHaveText(['1', '2', '3']);
});

test('a session note opens on its field and stays however the sheet closes', async ({ page }) => {
	await exerciseAction(page, 'Bench Press', 'Add note');

	const sheet = page
		.getByRole('dialog', { name: 'Bench Press' })
		.filter({ has: page.getByRole('textbox', { name: 'Note' }) });
	const field = sheet.getByRole('textbox', { name: 'Note' });

	await expect(field).toBeFocused();
	await expect(sheet.getByRole('button', { name: 'Done' })).toBeInViewport();

	// Settled once two polls in a row find it where it was: it slides in.
	let opened: string | null = null;
	await expect
		.poll(async () => {
			const box = JSON.stringify(await sheet.boundingBox());
			const still = box === opened;
			opened = box;

			return still;
		})
		.toBe(true);

	await page.keyboard.type('Seat at 5');
	expect(JSON.stringify(await sheet.boundingBox())).toBe(opened);

	await (onDesk(page)
		? page.keyboard.press('Escape')
		: drag(page, sheet.getByText('Bench Press', { exact: true }), 0, 500));

	await expect(sheet).toBeHidden();
	await expect(exerciseBlock(page, 'Bench Press')).toContainText('Seat at 5');

	await exerciseAction(page, 'Bench Press', 'Edit note');
	await expect(field).toHaveValue('Seat at 5');
	await page.keyboard.type(', left shoulder');
	await sheet.getByRole('button', { name: 'Done' }).click();
	await expect(sheet).toBeHidden();
	await expect(exerciseBlock(page, 'Bench Press')).toContainText('Seat at 5, left shoulder');
});
