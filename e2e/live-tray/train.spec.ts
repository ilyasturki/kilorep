import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures.ts';
import { bounds, logSet, readStore, startPlan, themeColor } from '../helpers.ts';

test.use({ seeded: true });

function startCard(page: Page): Locator {
	return page
		.getByRole('main')
		.locator('section', { has: page.getByRole('button', { name: 'START', exact: true }) });
}

test(
	'START sits right above the tab bar, everything else above it',
	{ tag: '@phone' },
	async ({ page, account: _account }) => {
		await page.goto('/train');

		const main = page.getByRole('main');
		const card = startCard(page);
		const start = card.getByRole('button', { name: 'START', exact: true });
		const tabs = page.getByRole('navigation', { name: 'Main' });

		await expect(start).toBeVisible();
		await expect(card.getByText('Next up', { exact: true })).toBeVisible();

		const bar = await bounds(tabs);
		const held = await bounds(card);
		const thumb = await bounds(start);
		expect(Math.abs(held.bottom - bar.top)).toBeLessThanOrEqual(1);
		expect(bar.top - thumb.bottom).toBeLessThanOrEqual(32);

		const others = await main
			.locator('section', { has: page.getByRole('heading', { name: 'Start another' }) })
			.getByRole('button')
			.all();
		const above = [
			...others,
			main.getByRole('link', { name: 'All templates' }),
			main.getByRole('link', { name: 'History' })
		];
		expect(above.length).toBeGreaterThanOrEqual(4);
		await expect(main.getByRole('button', { name: /^Empty workout/u })).toBeVisible();

		for (const row of above) {
			const { bottom } = await bounds(row);
			expect(bottom).toBeLessThanOrEqual(held.top);
		}
	}
);

test(
	'a list longer than the screen scrolls under the card',
	{ tag: '@phone' },
	async ({ page, account: _account }) => {
		await page.setViewportSize({ width: 420, height: 520 });
		await page.goto('/train');

		const main = page.getByRole('main');
		const card = startCard(page);
		const history = main.getByRole('link', { name: 'History' });

		await expect(card.getByRole('button', { name: 'START', exact: true })).toBeVisible();

		const resting = await bounds(card);
		const hidden = await bounds(history);
		expect(hidden.bottom).toBeGreaterThan(resting.top);

		await main.evaluate((pane) => {
			pane.scrollTo({ top: pane.scrollHeight });
		});
		await expect
			.poll(async () => {
				const { bottom } = await bounds(history);

				return bottom;
			})
			.toBeLessThanOrEqual(resting.top);

		const scrolled = await bounds(card);
		expect(Math.abs(scrolled.top - resting.top)).toBeLessThanOrEqual(1);
		expect(Math.abs(scrolled.bottom - resting.bottom)).toBeLessThanOrEqual(1);
	}
);

test('a running session takes the card, and its minutes keep up', async ({
	page,
	account: _account
}) => {
	await page.clock.install();
	await startPlan(page, 'Push Day');
	await logSet(page);
	await expect(page.getByRole('button', { name: /^Rest timer/u })).toBeVisible();

	await page.goBack();
	await page.waitForURL('**/train');

	const main = page.getByRole('main');
	await expect(main.getByText('In progress', { exact: true })).toBeVisible();
	await expect(main.getByText('Just started', { exact: true })).toBeVisible();
	await expect(main.getByText('Push Day', { exact: true })).toBeVisible();
	await expect(main.getByText(/^1 of \d+ sets logged$/u)).toBeVisible();

	const resume = main.getByRole('link', { name: 'RESUME' });
	await expect(resume).toBeVisible();
	await expect(resume.locator('svg')).toBeVisible();

	await expect(main.getByRole('button', { name: 'START', exact: true })).toHaveCount(0);
	await expect(main.getByRole('button', { name: /^Empty workout/u })).toHaveCount(0);
	await expect(main.getByRole('heading', { name: 'Start another' })).toHaveCount(0);

	await page.clock.fastForward('05:00');
	await expect(main.getByText('5 min', { exact: true })).toBeVisible();
	await page.clock.fastForward('03:00');
	await expect(main.getByText('8 min', { exact: true })).toBeVisible();

	await resume.click();
	await page.waitForURL('**/train/live');
});

test('the running card draws the plan’s mark beside its name', async ({
	page,
	account: _account
}) => {
	await page.goto('/plan/templates');
	await page
		.getByRole('main')
		.getByRole('link', { name: /^Push Day/u })
		.first()
		.click();
	await page.getByRole('button', { name: 'Pick a template icon' }).click();

	const icons = page.getByRole('dialog').getByRole('group', { name: 'Icon' });
	const icon = icons.getByRole('radio').or(icons.getByRole('button')).first();
	const glyph = (await icon.locator('path').first().getAttribute('d')) ?? '';
	expect(glyph).not.toBe('');
	await icon.click();
	await page.keyboard.press('Escape');

	await expect
		.poll(async () => {
			const { records } = await readStore(page);

			return records.some(
				(record) =>
					record.kind === 'template' &&
					JSON.stringify(record.payload).includes('"Push Day"') &&
					JSON.stringify(record.payload).includes('"mark"')
			);
		})
		.toBe(true);

	await startPlan(page, 'Push Day');
	await page.goto('/train');

	const card = page
		.getByRole('main')
		.locator('section', { has: page.getByRole('link', { name: 'RESUME' }) });
	await expect(card.getByText('Push Day', { exact: true })).toBeVisible();
	await expect(card.locator(`path[d="${glyph}"]`)).toBeVisible();
});

test('the launcher shortcut resumes a running session rather than starting another', async ({
	page,
	account: _account
}) => {
	await startPlan(page, 'Push Day');
	await logSet(page);
	await expect(page.getByRole('button', { name: /^Rest timer/u })).toBeVisible();

	await page.goto('/train?start=next');
	await page.waitForURL('**/train/live');

	await page.goto('/train');
	await expect(page.getByRole('main').getByText(/^1 of \d+ sets logged$/u)).toBeVisible();
});

test('the ages on idle Train move on with the clock', async ({ page, account: _account }) => {
	await page.clock.install();
	await page.goto('/train');

	const ages = page.getByRole('main').getByText(/^(?:Today|(?:[1-9]|1[0-2])d ago)$/u);
	await expect(ages.first()).toBeVisible();

	const before = await ages.allTextContents();
	const after = before.map((age) =>
		age === 'Today' ? '1d ago' : age.replace(/\d+/u, (days) => String(Number(days) + 1))
	);

	await page.clock.fastForward('24:00:00');
	await expect(ages).toHaveText(after);
});

for (const tab of ['/train', '/progress', '/bodyweight', '/settings']) {
	test(`${tab} has no title row`, async ({ page, isMobile, account: _account }) => {
		await page.goto(tab);

		const banner = page.getByRole('banner');
		const main = page.getByRole('main');

		await expect(main).toBeVisible();
		await expect(banner.getByRole('heading')).toHaveCount(0);

		if (!isMobile) {
			return;
		}

		const bar = await bounds(banner);
		const pane = await bounds(main);
		expect(bar.bottom).toBe(0);
		expect(pane.top).toBe(0);

		const header = await banner.evaluate((element) => getComputedStyle(element).backgroundColor);
		expect(header).toBe(await themeColor(page, '--canvas'));
	});
}
