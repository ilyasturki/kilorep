import type { Locator, Page } from '@playwright/test';

import { expect, test } from '../fixtures.ts';
import { bounds, finger, openRecord, startPlan } from '../helpers.ts';

test.use({ seeded: true });

function handle(page: Page): Locator {
	return page.getByRole('button', { name: /^(?:Lower|Raise) the set editor$/u });
}

function tray(page: Page): Locator {
	return handle(page).locator('xpath=..');
}

async function middle(locator: Locator): Promise<{ x: number; y: number }> {
	const { top, bottom, left, right } = await bounds(locator);

	return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

/** Whether the sheet rides a finger that pulls it down a little and puts it back. */
async function followsFinger(page: Page, sheet: Locator): Promise<boolean> {
	const at = await middle(sheet.locator('[data-vaul-handle]'));
	const probe = await finger(page);
	await probe.down(at);
	await probe.move({ x: at.x, y: at.y + 40 }, 160);
	const followed = await sheet.evaluate(
		(panel) => new DOMMatrix(getComputedStyle(panel).transform).m42
	);
	await probe.move(at, 160);
	await probe.up();

	return followed > 20;
}

/** The ruler named `label` covers the whole pane, the top bar included, then goes. */
async function expectFullRuler(page: Page, field: Locator, label: string): Promise<void> {
	await field.click();

	const ruler = page.getByRole('group', { name: `Pick a ${label}` });
	await expect(ruler).toBeVisible();

	const viewport = page.viewportSize() ?? { width: 0, height: 0 };
	expect(await bounds(ruler)).toEqual({
		top: 0,
		bottom: viewport.height,
		left: 0,
		right: viewport.width
	});

	const bar = await middle(page.getByRole('banner'));
	const covered = await ruler.evaluate(
		(element, point) => element.contains(document.elementFromPoint(point.x, point.y)),
		bar
	);
	expect(covered).toBe(true);

	await field.press('Escape');
	await expect(ruler).toBeHidden();
}

test.describe('on a phone', { tag: '@phone' }, () => {
	test('the ruler fills the screen from kg, reps and RPE', async ({ page, account: _account }) => {
		await startPlan(page, 'Push Day');

		const editor = tray(page);
		await expectFullRuler(page, editor.getByRole('textbox', { name: 'kg' }), 'kg');
		await expectFullRuler(page, editor.getByRole('textbox', { name: 'reps' }), 'reps');

		await editor.getByRole('button', { name: /^(?:Rate this set in RPE|Rated )/u }).click();
		await editor
			.getByRole('radio', { name: 'Other RPE value' })
			.or(editor.getByRole('button', { name: 'Other RPE value' }))
			.click();
		await expectFullRuler(page, editor.getByRole('textbox', { name: 'RPE' }), 'RPE');
	});

	test('reps take whole numbers, kg a decimal', async ({ page, account: _account }) => {
		await startPlan(page, 'Push Day');

		const editor = tray(page);
		const kg = editor.getByRole('textbox', { name: 'kg' });
		const reps = editor.getByRole('textbox', { name: 'reps' });

		await expect(reps).toHaveAttribute('inputmode', 'numeric');
		await expect(kg).toHaveAttribute('inputmode', 'decimal');

		await reps.focus();
		await reps.pressSequentially('9.,');
		await expect(reps).toHaveValue('9');
		await reps.press('Escape');

		await kg.focus();
		await kg.pressSequentially('82.5');
		await expect(kg).toHaveValue('82.5');
		await kg.press('Escape');
	});

	test('the tray reads TARGET and LAST apart, under a Log set taller than the rest', async ({
		page,
		account: _account
	}) => {
		await startPlan(page, 'Push Day');

		const editor = tray(page);
		const target = editor.getByText('Target', { exact: true });
		const last = editor.getByText('Last', { exact: true });

		await expect(target).toBeVisible();
		await expect(target.locator('xpath=following-sibling::*[1]')).toHaveText('8 reps');
		await expect(last).toBeVisible();
		await expect(last.locator('xpath=following-sibling::*[1]')).toHaveText(/^\S+ × \d+/u);

		const targetAt = await bounds(target);
		const lastAt = await bounds(last);
		expect(Math.abs(targetAt.top - lastAt.top)).toBeLessThan(4);
		expect(lastAt.left).toBeGreaterThan(targetAt.right);

		const commit = await bounds(editor.getByRole('button', { name: 'Log set', exact: true }));
		const tallest = commit.bottom - commit.top;
		const others = [
			editor.getByRole('group', { name: 'kg' }),
			editor.getByRole('group', { name: 'reps' }),
			editor.getByRole('button', { name: 'Set options' }),
			handle(page)
		];

		for (const control of others) {
			const { top, bottom } = await bounds(control);
			expect(bottom - top).toBeLessThan(tallest);
		}

		// The RPE pill shares Log set's row and stands as tall as it, never taller.
		const rate = await bounds(editor.getByRole('button', { name: /^(?:Rate this set|Rated )/u }));
		expect(rate.bottom - rate.top).toBeLessThanOrEqual(tallest);
	});

	test('a still tap on the handle does nothing; a drag lowers the tray to a strip', async ({
		page,
		account: _account
	}) => {
		await startPlan(page, 'Push Day');

		const lower = page.getByRole('button', { name: 'Lower the set editor' });
		const raise = page.getByRole('button', { name: 'Raise the set editor' });
		const commit = page.getByRole('button', { name: 'Log set', exact: true });

		await lower.tap();
		await lower.tap();
		await expect(lower).toHaveAttribute('aria-expanded', 'true');
		await expect(commit).toBeEnabled();

		const viewport = page.viewportSize() ?? { width: 0, height: 0 };
		const start = await middle(lower);
		const pull = await finger(page);
		await pull.down(start);
		await pull.move({ x: start.x, y: viewport.height - 4 }, 400);
		await pull.up();

		await expect(raise).toHaveAttribute('aria-expanded', 'false');
		await expect
			.poll(async () => {
				const { top } = await bounds(tray(page));

				return top;
			})
			.toBeGreaterThanOrEqual(viewport.height - 60);

		const strip = await bounds(raise);
		expect(strip.bottom).toBeLessThanOrEqual(viewport.height);
		expect(strip.top).toBeGreaterThanOrEqual(viewport.height - 60);
		expect(await commit.evaluate((element) => element.closest('[inert]') !== null)).toBe(true);

		await raise.tap();
		await expect(lower).toHaveAttribute('aria-expanded', 'true');
		await expect
			.poll(async () => {
				const { bottom } = await bounds(tray(page));

				return bottom;
			})
			.toBeLessThanOrEqual(viewport.height + 1);
		expect(await commit.evaluate((element) => element.closest('[inert]') === null)).toBe(true);

		const back = await middle(lower);
		const drop = await finger(page);
		await drop.down(back);
		await drop.move({ x: back.x, y: viewport.height - 4 }, 400);
		await drop.up();
		await expect(raise).toBeVisible();

		const peek = await middle(raise);
		const lift = await finger(page);
		await lift.down(peek);
		await lift.move({ x: peek.x, y: viewport.height / 3 }, 400);
		await lift.up();
		await expect(lower).toHaveAttribute('aria-expanded', 'true');
	});

	for (const [name, open] of [
		[
			'Set options',
			async (page: Page): Promise<Locator> => {
				await tray(page).getByRole('button', { name: 'Set options' }).click();

				return page.getByRole('dialog');
			}
		],
		[
			'Add exercise',
			async (page: Page): Promise<Locator> => {
				await page
					.getByRole('button', { name: /^(?:Add exercise|Exercise)$/u })
					.first()
					.click();

				return page.getByRole('dialog', { name: 'Add exercise' });
			}
		]
	] as const) {
		test(`the ${name} sheet ignores a rolling tap on its handle and closes on a flick`, async ({
			page,
			account: _account
		}) => {
			await startPlan(page, 'Push Day');

			const sheet = await open(page);
			await expect(sheet).toBeVisible();

			const grip = sheet.locator('[data-vaul-handle]');
			const viewport = page.viewportSize() ?? { width: 0, height: 0 };

			// vaul takes no drag for a moment after opening, and a roll then would prove nothing.
			await expect
				.poll(async () => {
					const rides = await followsFinger(page, sheet);

					return rides;
				})
				.toBe(true);

			await sheet.evaluate((panel) => {
				const watch = globalThis as unknown as { sheetClosed: boolean };
				watch.sheetClosed = false;
				new MutationObserver(() => {
					watch.sheetClosed ||= !panel.isConnected || panel.dataset.state !== 'open';
				}).observe(document.body, { attributes: true, childList: true, subtree: true });
			});

			const thumb = await finger(page);

			// A roll that closes does so a beat after the release; a sheet still following a finger
			// has had that beat.
			for (const roll of [10, 8, 4]) {
				await thumb.tap(await middle(grip), { x: roll / 2, y: roll });
				await expect
					.poll(async () => {
						const rides = await followsFinger(page, sheet);

						return rides;
					})
					.toBe(true);

				const closed = await page.evaluate(
					() => (globalThis as unknown as { sheetClosed: boolean }).sheetClosed
				);
				expect(closed).toBe(false);
			}

			const at = await middle(grip);
			const flick = await finger(page);
			await flick.down(at);
			await flick.move({ x: at.x, y: viewport.height - 4 }, 120);
			await flick.up();
			await expect(sheet).toBeHidden();
		});
	}
});

// The desk plan editor steps its numbers and types none.
test(
	'a plan’s sets and reps take whole numbers',
	{ tag: '@phone' },
	async ({ page, account: _account }) => {
		await page.goto('/plan/templates');
		await page
			.getByRole('main')
			.getByRole('link', { name: /^Push Day/u })
			.first()
			.click();
		await page.getByRole('button', { name: /^Bench Press Standard/u }).click();

		for (const label of ['sets', 'reps']) {
			const field = page.getByRole('main').getByRole('textbox', { name: label, exact: true });
			await expect(field).toHaveAttribute('inputmode', 'numeric');

			await field.focus();
			await field.pressSequentially('3.,');
			await expect(field).toHaveValue('3');
			await field.press('Escape');
		}
	}
);

test('a record’s cells are typed in place: decimal kg, whole reps', async ({
	page,
	account: _account
}) => {
	await openRecord(page, 'Push Day');
	const edit = page.getByRole('banner').getByRole('button', { name: 'Edit this workout' });

	if (await edit.isVisible()) {
		await edit.click();
	} else {
		await page.getByRole('button', { name: 'Workout options' }).click();
		await page.getByRole('button', { name: 'Edit workout' }).click();
	}
	await expect(page.getByRole('banner').getByRole('button', { name: 'SAVE' })).toBeVisible();

	const main = page.getByRole('main');
	const kg = main.getByRole('textbox', { name: 'Set 1 kg' }).first();
	const reps = main.getByRole('textbox', { name: 'Set 1 reps' }).first();

	await expect(kg).toHaveAttribute('inputmode', 'decimal');
	await expect(reps).toHaveAttribute('inputmode', 'numeric');

	await reps.click();
	await reps.pressSequentially('6');
	await expect(reps).toBeFocused();
	await expect(page.getByRole('group', { name: /^Pick a /u })).toHaveCount(0);
});
