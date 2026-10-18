import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures.ts';
import { bounds, finish, logSet, onGrid, readStore, startPlan, themeColor } from '../helpers.ts';

test.use({ seeded: true });

function chip(page: Page): Locator {
	return page.getByRole('banner').getByRole('button', { name: /^Rest timer, /u });
}

/** What the chip counts, in seconds: negative once the rest has run over. */
async function remaining(page: Page): Promise<number> {
	const name = (await chip(page).getAttribute('aria-label')) ?? '';
	const [, over = '', minutes = '', seconds = ''] =
		/^Rest timer, (?<over>\+?)(?<minutes>\d+):(?<seconds>\d\d)\./u.exec(name) ?? [];

	if (minutes === '') {
		throw new Error(`the rest chip reads "${name}"`);
	}

	return (over === '+' ? -1 : 1) * (Number(minutes) * 60 + Number(seconds));
}

// A sheet on a phone, a popover on the desk: the timer heads both.
async function openControls(page: Page): Promise<Locator> {
	await chip(page).click();
	await expect(page.getByRole('timer', { name: 'Rest timer' })).toBeVisible();

	return page.locator('body');
}

async function skip(page: Page): Promise<void> {
	const controls = await openControls(page);
	await controls.getByRole('button', { name: 'SKIP' }).click();
	await expect(page.getByRole('timer', { name: 'Rest timer' })).toBeHidden();
}

async function waitForSavedRest(page: Page, held: 'rest' | 'dismissed'): Promise<void> {
	await expect
		.poll(async () => {
			const { meta } = await readStore(page);

			return Object.values(meta).some(
				(value) =>
					typeof value === 'object' &&
					value !== null &&
					held in value &&
					(value as Record<string, unknown>)[held] !== null
			);
		})
		.toBe(true);
}

type Notified = { permission: NotificationPermission; shown: string[] };

// Capacitor's web notifications go through `window.Notification`; this one records what it shows.
async function stubNotifications(page: Page, permission: NotificationPermission): Promise<void> {
	await page.addInitScript((initial) => {
		const notified: Notified = { permission: initial, shown: [] };

		class Recorded extends EventTarget {
			public constructor(title: string) {
				super();
				notified.shown.push(title);
			}

			public static get permission(): NotificationPermission {
				return notified.permission;
			}

			public static async requestPermission(): Promise<NotificationPermission> {
				const asked = await Promise.resolve(notified.permission);

				return asked;
			}

			public close(): void {
				this.dispatchEvent(new Event('close'));
			}
		}

		Object.assign(globalThis, { Notification: Recorded, notified });
	}, permission);
}

async function restOvers(page: Page): Promise<number> {
	const count = await page.evaluate(
		() =>
			(globalThis as unknown as { notified: Notified }).notified.shown.filter(
				(title) => title === 'Rest over'
			).length
	);

	return count;
}

test('the rest chip arrives on a tab root as a row of its own, and leaves with the rest', async ({
	page,
	isMobile,
	account: _account
}) => {
	await startPlan(page, 'Push Day');
	await logSet(page);
	await expect(chip(page)).toBeVisible();

	await page.goBack();
	await page.waitForURL('**/train');
	await page
		.getByRole('navigation', { name: 'Main' })
		.getByRole('link', { name: 'Progress' })
		.click();
	await page.waitForURL('**/progress');

	const banner = page.getByRole('banner');
	const main = page.getByRole('main');

	await expect(chip(page)).toBeVisible();
	await expect(banner.getByRole('heading')).toHaveCount(0);

	if (isMobile) {
		await expect(banner.getByRole('button')).toHaveCount(1);
		await expect(banner.getByRole('link')).toHaveCount(0);
		const ground = await banner.evaluate((element) => getComputedStyle(element).backgroundColor);
		expect(ground).toBe(await themeColor(page, '--canvas'));

		const row = await bounds(banner);
		const face = await bounds(chip(page));
		expect(row.right - face.right).toBeLessThanOrEqual(16);
		expect(face.left).toBeGreaterThan(row.right / 2);
	}

	const withRow = await bounds(main);
	expect(withRow.top).toBeGreaterThan(0);

	await skip(page);
	const bringBack = banner.getByRole('button', { name: 'Bring back the skipped rest' });
	await expect(bringBack).toBeVisible();
	await expect(bringBack).toHaveText('REST');
	const skipped = await bounds(main);
	expect(skipped.top).toBe(withRow.top);

	await page.goto('/train/live');
	await finish(page);
	await page.goto('/progress');
	await expect(main).toBeVisible();
	await expect(bringBack).toHaveCount(0);
	await expect(chip(page)).toHaveCount(0);

	if (isMobile) {
		const without = await bounds(main);
		expect(without.top).toBe(0);
	}
});

test('FINISH is cobalt caps text beside the rest chip, unlike the filled Log set', async ({
	page,
	isMobile,
	account: _account
}) => {
	await startPlan(page, 'Push Day');
	await logSet(page);

	const finishButton = page
		.getByRole('banner')
		.getByRole('button', { name: 'FINISH', exact: true });
	await expect(finishButton).toBeVisible();
	await expect(chip(page)).toBeVisible();

	const look = await finishButton.evaluate((element) => {
		const style = getComputedStyle(element);

		return {
			text: element.textContent.trim(),
			color: style.color,
			background: style.backgroundColor,
			border: style.borderTopWidth
		};
	});
	expect(look).toEqual({
		text: 'FINISH',
		color: await themeColor(page, '--accent-text'),
		background: 'rgba(0, 0, 0, 0)',
		border: '0px'
	});

	const face = await bounds(chip(page));
	const button = await bounds(finishButton);
	expect(button.left).toBeGreaterThan(face.right);
	expect(button.left - face.right).toBeLessThanOrEqual(16);
	expect(Math.abs((button.top + button.bottom) / 2 - (face.top + face.bottom) / 2)).toBeLessThan(2);

	// The desk logs from the ledger's row checks, with no filled button to tell apart.
	if (!isMobile) {
		return;
	}

	const filled = page.getByRole('button', { name: 'Log set', exact: true });
	await expect(filled).toBeVisible();
	const fill = await filled.evaluate((element) => getComputedStyle(element).backgroundColor);
	expect(fill).toBe(await themeColor(page, '--accent'));
});

test('the rest controls keep SKIP clear of turning rest off, and REST OFF comes back in one tap', async ({
	page,
	isMobile,
	account: _account
}) => {
	await startPlan(page, 'Push Day');
	await logSet(page);
	await expect(chip(page)).toBeVisible();

	const controls = await openControls(page);
	const cut = controls.getByRole('button', { name: 'Cut 30 seconds' });
	const add = controls.getByRole('button', { name: 'Add 30 seconds' });
	const skipButton = controls.getByRole('button', { name: 'SKIP' });
	const mute = controls.getByRole('button', { name: 'Turn rest off for this session' });

	// Reach is a thumb's question; the desk popover also scales in while it is measured.
	if (isMobile) {
		for (const control of [cut, add, skipButton, mute]) {
			const at = await bounds(control);
			expect(at.bottom - at.top).toBeGreaterThanOrEqual(44);
		}

		// Both read in one frame: the sheet is still sliding in, and two reads would straddle it.
		const gap = await page.getByRole('dialog').evaluate((sheet) => {
			const buttons = [...sheet.querySelectorAll('button')];
			const find = (text: string): HTMLButtonElement | undefined =>
				buttons.find((button) => button.textContent.trim() === text);
			const slip = find('SKIP');
			const off = find('Turn rest off for this session');

			if (slip === undefined || off === undefined) {
				return -1;
			}

			return off.getBoundingClientRect().top - slip.getBoundingClientRect().bottom;
		});
		expect(onGrid(gap)).toBeGreaterThanOrEqual(24);
	}

	const before = await remaining(page);
	await add.click();
	await expect
		.poll(async () => {
			const read = await remaining(page);

			return read;
		})
		.toBeGreaterThan(before + 25);
	await cut.click();
	await cut.click();
	await expect
		.poll(async () => {
			const read = await remaining(page);

			return read;
		})
		.toBeLessThan(before - 25);
	const left = await remaining(page);

	await mute.click();
	await expect(page.getByRole('timer', { name: 'Rest timer' })).toBeHidden();

	const off = page.getByRole('banner').getByRole('button', {
		name: 'Rest is off for this session. Turn it back on'
	});
	await expect(off).toHaveText('REST OFF');
	await expect(chip(page)).toHaveCount(0);

	await off.click();
	await expect(chip(page)).toBeVisible();
	const back = await remaining(page);
	expect(back).toBeLessThanOrEqual(left);
	expect(back).toBeGreaterThan(left - 10);
});

test(
	'with REST OFF on a narrow phone the bar stays one row',
	{ tag: '@phone' },
	async ({ page, account: _account }) => {
		await startPlan(page, 'Push Day');
		await logSet(page);

		const banner = page.getByRole('banner');
		const title = banner.getByRole('heading');
		await expect(title).toHaveText(/^1 of \d+ sets$/u);
		const oneRow = await bounds(banner);

		const controls = await openControls(page);
		await controls.getByRole('button', { name: 'Turn rest off for this session' }).click();
		await expect(page.getByRole('timer', { name: 'Rest timer' })).toBeHidden();

		await page.setViewportSize({ width: 320, height: 640 });

		const off = banner.getByRole('button', { name: /^Rest is off/u });
		const finishButton = banner.getByRole('button', { name: 'FINISH', exact: true });
		await expect(off).toHaveText('REST OFF');

		const row = await bounds(banner);
		expect(row.bottom - row.top).toBe(oneRow.bottom - oneRow.top);

		for (const part of [off, finishButton]) {
			const at = await bounds(part);
			expect(at.right).toBeLessThanOrEqual(320);
			expect(at.bottom).toBeLessThanOrEqual(row.bottom);
		}

		const [lines, clipped] = await title.evaluate((element) => [
			element.getClientRects().length,
			getComputedStyle(element).whiteSpace === 'nowrap' &&
				getComputedStyle(element).textOverflow === 'ellipsis'
		]);
		expect(lines).toBe(1);
		expect(clipped).toBe(true);
		const heading = await bounds(title);
		const face = await bounds(off);
		expect(heading.right).toBeLessThanOrEqual(face.left);
	}
);

test('a skipped rest comes back with the same end after the app is killed', async ({
	page,
	account: _account
}) => {
	await stubNotifications(page, 'granted');
	await page.clock.install();
	await startPlan(page, 'Push Day');
	await logSet(page);
	await expect(chip(page)).toBeVisible();

	const length = await remaining(page);
	expect(length).toBeGreaterThan(60);

	await skip(page);
	await waitForSavedRest(page, 'dismissed');

	await page.clock.fastForward('00:30');
	await page.reload();

	const bringBack = page.getByRole('button', { name: 'Bring back the skipped rest' });
	await bringBack.click();
	await expect(chip(page)).toBeVisible();

	const left = await remaining(page);
	expect(left).toBeLessThanOrEqual(length - 30);
	expect(left).toBeGreaterThan(length - 150);

	await page.clock.fastForward((left - 2) * 1000);
	expect(await restOvers(page)).toBe(0);
	await page.clock.fastForward(3000);
	await expect
		.poll(async () => {
			const read = await restOvers(page);

			return read;
		})
		.toBe(1);
});

test('a skipped rest brought back after its end counts up past zero', async ({
	page,
	account: _account
}) => {
	await page.clock.install();
	await startPlan(page, 'Push Day');
	await logSet(page);
	await expect(chip(page)).toBeVisible();

	const length = await remaining(page);

	await skip(page);
	await waitForSavedRest(page, 'dismissed');

	await page.clock.fastForward((length + 20) * 1000);
	await page.reload();

	await page.getByRole('button', { name: 'Bring back the skipped rest' }).click();
	await expect(chip(page)).toBeVisible();

	const over = await remaining(page);
	expect(over).toBeLessThanOrEqual(-18);
	expect(over).toBeGreaterThan(-150);

	await page.clock.fastForward('00:10');
	await expect
		.poll(async () => {
			const read = await remaining(page);

			return read;
		})
		.toBeLessThanOrEqual(over - 10);
});

test('a notification turned back on mid-session announces the next rest', async ({
	page,
	account: _account
}) => {
	await stubNotifications(page, 'denied');
	await page.clock.install();
	await startPlan(page, 'Push Day');
	await logSet(page);
	await expect(chip(page)).toBeVisible();

	const first = await remaining(page);
	await page.clock.fastForward('00:10');
	await expect
		.poll(async () => {
			const read = await remaining(page);

			return read;
		})
		.toBeLessThanOrEqual(first - 10);

	await page.clock.fastForward(first * 1000);
	await expect
		.poll(async () => {
			const read = await remaining(page);

			return read;
		})
		.toBeLessThan(0);
	expect(await restOvers(page)).toBe(0);

	await page.evaluate(() => {
		(globalThis as unknown as { notified: Notified }).notified.permission = 'granted';
	});

	await logSet(page);
	await expect
		.poll(async () => {
			const read = await remaining(page);

			return read;
		})
		.toBeGreaterThan(0);
	const second = await remaining(page);

	await page.clock.fastForward((second + 1) * 1000);
	await expect
		.poll(async () => {
			const read = await restOvers(page);

			return read;
		})
		.toBe(1);
});
