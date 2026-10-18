import type { Locator, Page } from '@playwright/test';

import { catalog } from '../../src/lib/catalog.ts';
import { expect, test } from '../fixtures.ts';
import { addExercise, finish, logSet, startEmpty } from '../helpers.ts';

function sheetNamed(page: Page, name: string): Locator {
	return page.getByRole('dialog', { name, exact: true });
}

function searchField(sheet: Locator): Locator {
	return sheet.getByRole('searchbox').or(sheet.getByRole('textbox')).first();
}

async function openAdd(page: Page): Promise<Locator> {
	await page
		.getByRole('button', { name: /^(?:Add exercise|Exercise)$/u })
		.last()
		.click();

	return sheetNamed(page, 'Add exercise');
}

// A menu on the desk, a sheet of buttons and links on a phone.
function menuItem(page: Page, name: string): Locator {
	return page
		.getByRole('menuitem', { name })
		.or(page.getByRole('dialog').getByRole('button', { name, exact: true }))
		.or(page.getByRole('dialog').getByRole('link', { name, exact: true }));
}

async function openSwap(page: Page, exercise: string): Promise<Locator> {
	await page
		.getByRole('main')
		.getByRole('button', { name: `${exercise} options`, exact: true })
		.first()
		.click();
	await menuItem(page, 'Swap exercise').click();

	return sheetNamed(page, 'Swap exercise');
}

function row(sheet: Locator, name: string): Locator {
	return sheet.getByRole('button', { name: new RegExp(`^${name} `, 'u') }).first();
}

async function settledBox(sheet: Locator): Promise<{ x: number; y: number; width: number }> {
	await expect(sheet).toBeVisible();
	let last = '';
	await expect
		.poll(async () => {
			const box = await sheet.boundingBox();
			const now = JSON.stringify(box);
			const still = now === last;
			last = now;

			return still;
		})
		.toBe(true);

	const { x, y, width } = JSON.parse(last) as { x: number; y: number; width: number };

	return { x, y, width };
}

test.describe('the search sheet as the field takes focus', () => {
	test.beforeEach(async ({ account: _signedIn, page }) => {
		await startEmpty(page);
		await addExercise(page, 'Bench Press');
	});

	for (const which of ['Add exercise', 'Swap exercise']) {
		test(`${which}: the sheet stays put and nothing shifts sideways`, async ({ page }) => {
			const sheet =
				which === 'Add exercise' ? await openAdd(page) : await openSwap(page, 'Bench Press');
			const before = await settledBox(sheet);

			await searchField(sheet).click();
			await expect(searchField(sheet)).toBeFocused();

			expect(await settledBox(sheet)).toEqual(before);
			expect(
				await page.evaluate(
					() => document.documentElement.scrollWidth - document.documentElement.clientWidth
				)
			).toBe(0);
		});

		test(
			`${which}: under the keys the title, the field and the results stay in view`,
			{ tag: '@phone' },
			async ({ page }) => {
				const sheet =
					which === 'Add exercise' ? await openAdd(page) : await openSwap(page, 'Bench Press');
				const before = await settledBox(sheet);
				await searchField(sheet).click();
				await searchField(sheet).fill('row');

				// The shell's viewport, shrunk by a keyboard as the phone measured it.
				await page.setViewportSize({ width: 420, height: 520 });

				const after = await settledBox(sheet);
				expect(after.x).toBe(before.x);
				expect(after.width).toBe(before.width);
				await expect(sheet.getByRole('heading', { name: which })).toBeInViewport();
				await expect(searchField(sheet)).toBeInViewport();
				await expect(row(sheet, 'Barbell Row')).toBeInViewport();
			}
		);
	}

	test('the new-exercise form stays docked under the keys', { tag: '@phone' }, async ({ page }) => {
		const sheet = page.getByRole('dialog', { name: /^(?:Add exercise|New exercise)$/u });
		await openAdd(page);
		await searchField(sheet).fill('tate press');
		await sheet.getByRole('button', { name: /^Create “tate press”/u }).click();
		const name = sheet.getByRole('textbox', { name: 'Name' });
		const before = await settledBox(sheet);
		await name.click();

		await page.setViewportSize({ width: 420, height: 520 });

		const after = await settledBox(sheet);
		expect(after.x).toBe(before.x);
		await expect(sheet.getByRole('heading', { name: 'New exercise' })).toBeInViewport();
		await expect(name).toBeInViewport();
		await expect(name).toBeFocused();
	});
});

test.describe('swapping an exercise with a logged set', () => {
	test.beforeEach(async ({ account: _signedIn, page }) => {
		await startEmpty(page);
		await addExercise(page, 'Bench Press');
		await logSet(page, { kg: 60, reps: 5 });

		const sheet = await openSwap(page, 'Bench Press');
		await searchField(sheet).fill('incline bench');
		await row(sheet, 'Incline Bench Press').click();
		await sheet.getByRole('button', { name: 'Swap exercise', exact: true }).click();
	});

	test('asks, naming both exercises', async ({ page }) => {
		const ask = page.getByRole('alertdialog', { name: '1 set logged on Bench Press' });

		await expect(ask.getByRole('button', { name: 'Move it to Incline Bench Press' })).toBeVisible();
		await expect(ask.getByRole('button', { name: 'Keep it on Bench Press' })).toBeVisible();
		await expect(ask.getByRole('button', { name: 'Delete it', exact: true })).toBeVisible();
	});

	test('Move it: the set keeps its numbers on the new exercise', async ({ page }) => {
		await page.getByRole('button', { name: 'Move it to Incline Bench Press' }).click();
		await finish(page);

		const main = page.getByRole('main');
		await expect(main.getByRole('heading', { name: 'Bench Press', exact: true })).toHaveCount(0);
		const moved = main.locator('section', {
			has: page.getByRole('heading', { name: 'Incline Bench Press', exact: true })
		});
		await expect(moved.getByRole('textbox', { name: 'Set 1 kg' })).toHaveValue('60');
		await expect(moved.getByRole('textbox', { name: 'Set 1 reps' })).toHaveValue('5');
	});

	test('Keep it: the logged set stays, the rest go to the new exercise', async ({ page }) => {
		await page.getByRole('button', { name: 'Keep it on Bench Press' }).click();
		await expect(
			page.getByRole('main').getByRole('button', { name: 'Incline Bench Press options' }).first()
		).toBeVisible();
		await logSet(page, { kg: 50, reps: 8 });
		await finish(page);

		const main = page.getByRole('main');
		const kept = main.locator('section', {
			has: page.getByRole('heading', { name: 'Bench Press', exact: true })
		});
		const added = main.locator('section', {
			has: page.getByRole('heading', { name: 'Incline Bench Press', exact: true })
		});
		await expect(kept.getByRole('textbox', { name: 'Set 1 kg' })).toHaveValue('60');
		await expect(kept.getByRole('textbox', { name: 'Set 2 kg' })).toHaveCount(0);
		await expect(added.getByRole('textbox', { name: 'Set 1 kg' })).toHaveValue('50');
	});

	test('Delete it: the new exercise starts fresh', async ({ page }) => {
		await page.getByRole('button', { name: 'Delete it', exact: true }).click();
		const main = page.getByRole('main');
		await expect(
			main.getByRole('button', { name: 'Incline Bench Press options' }).first()
		).toBeVisible();
		await expect(
			main.getByRole('button', { name: 'Bench Press options', exact: true })
		).toHaveCount(0);

		await logSet(page, { kg: 50, reps: 8 });
		await finish(page);
		const added = page.getByRole('main').locator('section', {
			has: page.getByRole('heading', { name: 'Incline Bench Press', exact: true })
		});
		await expect(added.getByRole('textbox', { name: 'Set 1 kg' })).toHaveValue('50');
		await expect(
			page.getByRole('main').getByRole('heading', { name: 'Bench Press', exact: true })
		).toHaveCount(0);
	});
});

test.describe('the add picker', () => {
	test.beforeEach(async ({ account: _signedIn, page }) => {
		await startEmpty(page);
	});

	test('a family folds behind its count and opens on demand', async ({ page }) => {
		const variants = catalog.filter((exercise) => exercise.variantOf === 'bench-press');
		const sheet = await openAdd(page);

		const show = sheet.getByRole('button', {
			name: `Show ${variants.length} variants of Bench Press`
		});
		await expect(show).toHaveText(String(variants.length));
		await expect(show).toHaveAttribute('aria-expanded', 'false');
		await expect(row(sheet, 'Incline Bench Press')).toBeHidden();

		await show.click();
		const hide = sheet.getByRole('button', {
			name: `Hide ${variants.length} variants of Bench Press`
		});
		await expect(hide).toHaveAttribute('aria-expanded', 'true');
		await expect(row(sheet, 'Incline Bench Press')).toBeVisible();
	});

	test('what the session holds is tagged "In session"', async ({ page }) => {
		await addExercise(page, 'Bench Press');
		const sheet = await openAdd(page);
		await searchField(sheet).fill('bench press');

		await expect(row(sheet, 'Bench Press')).toContainText('In session');
		await expect(row(sheet, 'Incline Bench Press')).not.toContainText('In session');
	});

	for (const [typed, grip] of [
		['chin', 'Supinated'],
		['pull up', 'Pronated']
	] as const) {
		test(`"${typed}" adds a Pull-Up held ${grip}`, async ({ page }) => {
			const sheet = await openAdd(page);
			await searchField(sheet).fill(typed);

			const pullUp = row(sheet, 'Pull-Up');
			await (typed === 'chin'
				? expect(pullUp).toContainText('Supinated')
				: expect(pullUp).not.toContainText(/Supinated|Pronated|Neutral/u));
			await pullUp.click();
			const commit = sheet.getByRole('button', { name: /^Add \d+ exercises?$/u });
			await expect
				.poll(async () => (await sheet.isHidden()) || (await commit.isVisible()))
				.toBe(true);
			if (await commit.isVisible()) {
				await commit.click();
			}
			await expect(sheet).toBeHidden();

			await page.getByRole('main').getByRole('button', { name: 'Pull-Up options' }).first().click();
			await menuItem(page, 'View exercise').click();
			await expect(page.getByRole('radio', { name: grip, exact: true })).toBeChecked();
		});
	}
});
