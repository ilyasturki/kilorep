import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures.ts';
import { addExercise, logSet, startEmpty } from '../helpers.ts';

import { drag, exerciseBlock, menuItem, onDesk, setRow } from './support.ts';

const A = 'Lateral Raise';
const B = 'Triceps Pushdown';

async function supersetSession(page: Page): Promise<Locator> {
	await startEmpty(page);
	await addExercise(page, A);

	await page.getByRole('button', { name: `${A} options`, exact: true }).click();
	await menuItem(page, 'Superset with…').click();

	const picker = page.getByRole('dialog', { name: `Superset ${A} with…` });
	await picker.getByRole('searchbox').or(picker.getByRole('textbox')).fill(B);
	await picker
		.getByRole('button', { name: new RegExp(`^${B} `, 'u') })
		.first()
		.click();
	await picker.getByRole('button', { name: 'Superset 1 exercise' }).click();
	await expect(picker).toBeHidden();

	const block = exerciseBlock(page, A);
	await expect(block.getByRole('button', { name: `${B} options`, exact: true })).toBeVisible();

	return block;
}

// `account` signs the page in. The clock goes in before the first page loads, for the rests.
test.beforeEach(async ({ page, account: _account }) => {
	await page.clock.install();
	await page.addInitScript(() => {
		const rang: string[] = [];

		// Stands in for the system: the web plugin rings a scheduled rest through it.
		class Rung extends EventTarget {
			public static readonly permission = 'granted';

			// Never called while permission reads granted, but the plugin wants one to exist.
			public static readonly requestPermission = (): unknown => Promise.resolve('granted');

			public constructor(title: string) {
				super();
				rang.push(title);
			}
		}

		Object.assign(globalThis, { Notification: Rung, rang });
	});
});

test('each name in the heading opens its own leg’s sheet', async ({ page }) => {
	await supersetSession(page);

	for (const [name, own, other] of [
		[A, 'Move back in superset', 'Move ahead in superset'],
		[B, 'Move ahead in superset', 'Move back in superset']
	] as const) {
		await page.getByRole('button', { name: `${name} options`, exact: true }).click();

		const sheet = page
			.getByRole('dialog', { name, exact: true })
			.or(page.getByRole('menu', { name, exact: true }));

		await expect(sheet).toBeVisible();
		await expect(menuItem(page, own)).toBeVisible();
		await expect(menuItem(page, other)).toHaveCount(0);
		await expect(menuItem(page, 'Remove from superset')).toBeVisible();

		await page.keyboard.press('Escape');
		await expect(page.getByRole('dialog').or(page.getByRole('menu'))).toHaveCount(0);
	}
});

test('logged rows carry their leg’s letter, and rounds part', async ({ page }) => {
	const block = await supersetSession(page);

	await logSet(page, { kg: 10, reps: 12 });
	await logSet(page, { kg: 20, reps: 12 });

	await expect(block.getByRole('img', { name: 'set A1 logged' })).toHaveText('A1');
	await expect(block.getByRole('img', { name: 'set B1 logged' })).toHaveText('B1');

	if (onDesk(page)) {
		return;
	}

	const box = async (mark: RegExp): Promise<{ top: number; bottom: number }> => {
		const found = await setRow(block, mark).boundingBox();

		if (found === null) {
			throw new Error(`no row for ${mark.source}`);
		}

		return { top: found.y, bottom: found.y + found.height };
	};

	const a1 = await box(/^set A1 /u);
	const b1 = await box(/^set B1 /u);
	const a2 = await box(/^set A2 /u);

	expect(a2.top - b1.bottom).toBeGreaterThan(b1.top - a1.bottom);
});

test('a superset row swipes as a lone exercise’s does', { tag: '@phone' }, async ({ page }) => {
	const block = await supersetSession(page);

	await logSet(page, { kg: 10, reps: 12 });
	await logSet(page, { kg: 20, reps: 12 });

	await drag(page, setRow(block, /^set B2 /u), 200, 0);
	await expect(block.getByRole('img', { name: 'set B2 logged' })).toBeVisible();

	await drag(page, setRow(block, 'set B2 logged'), 200, 0);
	await expect(block.getByRole('img', { name: /^set B2 (?:active|pending)$/u })).toBeVisible();

	await drag(page, setRow(block, /^set B3 /u), -200, 0);
	await expect(block.getByRole('img', { name: /^set B3 /u })).toHaveCount(0);

	await drag(page, setRow(block, /^set B2 /u), -200, 0);
	await expect(block.getByRole('img', { name: /^set B2 /u })).toHaveCount(0);

	await drag(page, setRow(block, 'set B1 logged'), -200, 0);
	await expect(page.getByRole('alertdialog')).toHaveCount(0);
	await expect(block.getByRole('img', { name: 'set B1 logged' })).toBeVisible();
});

test('one Rest over per round, none after A', async ({ page }) => {
	await supersetSession(page);

	const chip = page.getByRole('button', { name: /^Rest timer, /u });
	const rang = async (): Promise<string[]> => {
		const titles = await page.evaluate(() => (globalThis as unknown as { rang: string[] }).rang);

		return titles;
	};
	const restOut = async (): Promise<void> => {
		await page.clock.fastForward('02:10');
	};

	await logSet(page, { kg: 10, reps: 12 });
	await expect(chip).toHaveCount(0);
	await restOut();
	expect(await rang()).toEqual([]);

	await logSet(page, { kg: 20, reps: 12 });
	await expect(chip).toBeVisible();
	await restOut();
	await expect.poll(rang).toEqual(['Rest over']);

	await logSet(page);
	await restOut();
	expect(await rang()).toEqual(['Rest over']);

	await logSet(page);
	await restOut();
	await expect.poll(rang).toEqual(['Rest over', 'Rest over']);
});
