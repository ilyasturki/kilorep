import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures.ts';
import { bounds, finger, logSet, startPlan, themeColor } from '../helpers.ts';

test.use({ seeded: true });

// The swipe goes through at 0.6 of a 128px pull: 76.8px of travel.
const SHORT = 60;
const NEAR = 70;
const PAST = 85;
const THROUGH = 95;

function bench(page: Page): Locator {
	return page
		.getByRole('main')
		.locator('section', { has: page.getByRole('heading', { name: /^Bench Press/u }) });
}

function rowOf(page: Page, mark: RegExp): Locator {
	return bench(page).locator('[data-swipe-row]', { has: page.getByRole('img', { name: mark }) });
}

/** A slow pull from the row's left side, held where it ends: no flick, just travel. */
async function pull(
	page: Page,
	row: Locator,
	by: number
): Promise<Awaited<ReturnType<typeof finger>>> {
	const { top, bottom, left } = await bounds(row);
	const start = { x: left + 140, y: (top + bottom) / 2 };
	const thumb = await finger(page);

	await thumb.down(start);
	await thumb.move({ x: start.x + by, y: start.y }, Math.abs(by) * 12);

	return thumb;
}

async function opacity(locator: Locator): Promise<string> {
	const read = await locator.evaluate((element) => getComputedStyle(element).opacity);

	return read;
}

async function background(locator: Locator): Promise<string> {
	const read = await locator.evaluate((element) => getComputedStyle(element).backgroundColor);

	return read;
}

test.describe('on a phone', { tag: '@phone' }, () => {
	test('a set swiped right logs only past the point where Log brightens', async ({
		page,
		account: _account
	}) => {
		await startPlan(page, 'Push Day');

		const row = rowOf(page, /^set 4 /u);
		const label = row.getByText('Log', { exact: true });
		await expect(row.getByRole('img', { name: 'set 4 pending' })).toBeVisible();

		const thumb = await pull(page, row, NEAR);
		await expect
			.poll(async () => {
				const read = await opacity(label);

				return read;
			})
			.toBe('0.6');
		const { top, bottom, left } = await bounds(row);
		const y = (top + bottom) / 2;
		await thumb.move({ x: left + 140 + PAST, y }, 180);
		await expect
			.poll(async () => {
				const read = await opacity(label);

				return read;
			})
			.toBe('1');
		await thumb.move({ x: left + 140 + SHORT, y }, 300);
		await expect
			.poll(async () => {
				const read = await opacity(label);

				return read;
			})
			.toBe('0.6');
		await thumb.up();

		await expect(row.getByRole('img', { name: 'set 4 pending' })).toBeVisible();

		const again = await pull(page, row, THROUGH);
		await expect
			.poll(async () => {
				const read = await opacity(label);

				return read;
			})
			.toBe('1');
		await again.up();

		await expect(bench(page).getByRole('img', { name: /^set 4 pending/u })).toHaveCount(0);
	});

	test('a set swiped left goes only past the point where Remove darkens', async ({
		page,
		account: _account
	}) => {
		await startPlan(page, 'Push Day');

		const row = rowOf(page, /^set 4 /u);
		const label = row.getByText('Remove', { exact: true });
		const track = label.locator('xpath=..');
		await expect(row).toBeVisible();

		const thumb = await pull(page, row, -SHORT);
		const soft = await background(track);
		const { top, bottom, left } = await bounds(row);
		const y = (top + bottom) / 2;
		await thumb.move({ x: left + 140 - PAST, y }, 180);
		await expect
			.poll(async () => {
				const read = await background(track);

				return read;
			})
			.not.toBe(soft);
		await thumb.move({ x: left + 140 - SHORT, y }, 300);
		await expect
			.poll(async () => {
				const read = await background(track);

				return read;
			})
			.toBe(soft);
		await thumb.up();

		await expect(row).toBeVisible();

		const again = await pull(page, row, -THROUGH);
		await again.up();

		await expect(row).toHaveCount(0);
		await expect(bench(page).getByRole('img', { name: /^set 3 /u })).toBeVisible();
	});

	test('a pressed row darkens with a ripple, a hold opens its options', async ({
		page,
		account: _account
	}) => {
		await startPlan(page, 'Push Day');
		await logSet(page);

		const logged = rowOf(page, /logged/u).first();
		const surface = logged.locator('[data-ripple]');
		const resting = await background(surface);
		const { top, bottom, left } = await bounds(logged);

		await page.mouse.move(left + 140, (top + bottom) / 2);
		await page.mouse.down();
		await expect
			.poll(async () => {
				const read = await background(surface);

				return read;
			})
			.not.toBe(resting);
		await expect(surface.locator('.ripple-layer > *')).not.toHaveCount(0);

		const options = page.getByRole('dialog');
		await expect(options).toBeVisible();
		await page.mouse.up();
		await page.keyboard.press('Escape');
		await expect(options).toBeHidden();

		for (const name of ['Add set', 'Exercise']) {
			const add = bench(page).getByRole('button', { name, exact: true });
			const ground = add.locator('xpath=ancestor-or-self::*[@data-ripple][1]');
			const before = await background(ground);
			const at = await bounds(add);

			await page.mouse.move((at.left + at.right) / 2, (at.top + at.bottom) / 2);
			await page.mouse.down();
			await expect
				.poll(async () => {
					const read = await background(ground);

					return read;
				})
				.not.toBe(before);
			await expect(ground.locator('.ripple-layer > *')).not.toHaveCount(0);
			await page.mouse.up();
			await page.keyboard.press('Escape');
			await expect
				.poll(async () => {
					const read = await background(ground);

					return read;
				})
				.toBe(before);
		}
	});

	test('a tapped logged set turns blue, says Editing, and the tray offers Update set', async ({
		page,
		account: _account
	}) => {
		await startPlan(page, 'Push Day');
		await logSet(page);
		await expect(page.getByRole('button', { name: 'Log set', exact: true })).toBeVisible();

		const logged = rowOf(page, /logged/u).first();
		const surface = logged.locator('[data-ripple]');
		const plain = await background(surface);

		await logged.getByRole('button').first().tap();

		await expect(logged.getByText(/Editing$/u)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Update set', exact: true })).toBeVisible();

		const tint = await background(surface);
		expect(tint).not.toBe(plain);
		expect(tint).toBe(await themeColor(page, '--accent-soft'));
	});
});
