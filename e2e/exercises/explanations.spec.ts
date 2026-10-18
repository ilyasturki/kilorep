import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures.ts';
import { finishedSession, plantRecords } from '../plant.ts';

const MARKS = /^PR marks the set behind Heaviest ever\. Top e1RM marks/u;

const PRS = /^Each PR is a new Heaviest ever on that exercise/u;

// touchscreen.tap clicks in the instant it touches; bits-ui arms its outside-press listener 10ms after.
async function fingerTap(page: Page, x: number, y: number): Promise<void> {
	const cdp = await page.context().newCDPSession(page);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
	await page.clock.runFor(100);
	await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await cdp.detach();
}

function info(heading: Locator): Locator {
	return heading.getByRole('button', { name: 'More information' });
}

test.beforeEach(async ({ db, account, page }) => {
	await plantRecords(db, account.id, page, [
		finishedSession(9, [{ exerciseId: 'bench-press', sets: [{ kg: 60, reps: 8 }] }]),
		finishedSession(2, [{ exerciseId: 'bench-press', sets: [{ kg: 65, reps: 8 }] }])
	]);
});

for (const [where, path, title, text] of [
	['the History heading', '/plan/exercises/bench-press', /^History/u, MARKS],
	['Progress → Strength', '/progress', /^Last 4 weeks/u, PRS]
] as const) {
	const headingOf = (page: Page): Locator => page.getByRole('heading', { name: title });

	test(
		`${where}: one tap opens the explanation, a second closes it`,
		{ tag: '@phone' },
		async ({ page }) => {
			await page.goto(path);
			const bubble = page.getByText(text);

			await info(headingOf(page)).tap();
			await expect(bubble).toBeVisible();

			await info(headingOf(page)).tap();
			await expect(bubble).toBeHidden();
		}
	);

	test(`${where}: a tap outside closes the explanation`, { tag: '@phone' }, async ({ page }) => {
		await page.clock.install();
		await page.goto(path);
		const bubble = page.getByText(text);

		await info(headingOf(page)).tap();
		await expect(bubble).toBeVisible();

		// The far end of the heading the ⓘ sits in: blank, and nothing there answers a tap.
		const box = await headingOf(page).boundingBox();
		if (box === null) {
			throw new Error('the heading is not on screen');
		}
		await fingerTap(page, box.x + box.width - 8, box.y + box.height / 2);
		await expect(bubble).toBeHidden();
		await expect(page).toHaveURL(new RegExp(`${path}$`, 'u'));
	});

	test(`${where}: the explanation shows on hover`, { tag: '@desk' }, async ({ page }) => {
		await page.goto(path);
		const bubble = page.getByText(text);

		await info(headingOf(page)).hover();
		await expect(bubble).toBeVisible();

		await page.mouse.move(0, 0);
		await expect(bubble).toBeHidden();
	});
}
