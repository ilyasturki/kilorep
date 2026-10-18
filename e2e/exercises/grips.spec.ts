import type { Locator, Page } from '@playwright/test';

import { catalogById } from '../../src/lib/catalog.ts';

import { expect, test } from '../fixtures.ts';
import { finishedSession, plantRecords } from '../plant.ts';

function section(page: Page, heading: RegExp): Locator {
	return page
		.getByRole('main')
		.locator('section', { has: page.getByRole('heading', { name: heading }) });
}

function drawing(page: Page, name: string): Locator {
	return page.getByRole('main').getByRole('img', { name: `${name} illustration`, exact: true });
}

// A drawing is told apart by its outline: the browser reserializes the rest of the markup.
async function svgOf(page: Page, file: string): Promise<string> {
	const response = await page.request.get(`/illustrations/${file}.svg`);
	expect(response.ok(), `${file}.svg`).toBe(true);

	const [, d = ''] = /<path[^>]*\sd="(?<d>[^"]+)"/u.exec(await response.text()) ?? [];

	return d;
}

function outline(shown: Locator): Locator {
	return shown.locator('path').first();
}

/** Flags any moment the drawing is missing from the page, from now on. */
async function watchForBlank(page: Page, name: string): Promise<() => Promise<boolean>> {
	await page.evaluate((label) => {
		const selector = `main [role="img"][aria-label="${label}"] svg`;
		const flag = globalThis as unknown as { blanked: boolean };
		flag.blanked = document.querySelector(selector) === null;
		new MutationObserver(() => {
			if (document.querySelector(selector) === null) {
				flag.blanked = true;
			}
		}).observe(document.body, { childList: true, subtree: true });
	}, `${name} illustration`);

	return async () => {
		const blanked = await page.evaluate(
			() => (globalThis as unknown as { blanked: boolean }).blanked
		);

		return blanked;
	};
}

test.describe('Pull-Up across its grips', () => {
	test.beforeEach(async ({ db, account, page }) => {
		const sessions = [
			finishedSession(21, [
				{
					exerciseId: 'pull-up',
					sets: [
						{ kg: 5, reps: 8, grip: 'overhand' },
						{ kg: 5, reps: 8, grip: 'overhand' }
					]
				}
			]),
			finishedSession(14, [
				{
					exerciseId: 'pull-up',
					grip: 'underhand',
					sets: [
						{ kg: 10, reps: 6, grip: 'underhand' },
						{ kg: 10, reps: 5, grip: 'underhand' }
					]
				}
			]),
			finishedSession(7, [
				{
					exerciseId: 'pull-up',
					sets: [
						{ kg: 2.5, reps: 6, grip: 'overhand' },
						{ kg: 7.5, reps: 10, grip: 'neutral' }
					]
				}
			])
		];
		await plantRecords(db, account.id, page, sessions);
		await page.goto('/plan/exercises/pull-up');
	});

	test('opens on All with every session, each row naming its grip', async ({ page }) => {
		await expect(page.getByRole('radio', { name: 'All', exact: true })).toBeChecked();

		const rows = section(page, /^History/u).getByRole('link');
		await expect(rows).toHaveCount(3);
		await expect(rows.nth(0)).toContainText(/ · Pronated, Neutral/u);
		await expect(rows.nth(1)).toContainText(/ · Supinated/u);
		await expect(rows.nth(2)).toContainText(/ · Pronated(?!,)/u);
	});

	test('a chip narrows the best, the estimate, the calculator, the muscles and the history', async ({
		page
	}) => {
		const main = page.getByRole('main');
		const best = main.getByText(/^Heaviest ever/u).locator('xpath=ancestor::div[1]');
		const estimate = section(page, /^Estimated 1RM/u);
		const rows = section(page, /^History/u).getByRole('link');
		const header = main.locator('header');

		await expect(best).toContainText('10 × 6');
		await expect(estimate).toContainText(/^Estimated 1RM.*\b10 kg/u);
		await estimate.getByRole('button', { name: 'Work out a load' }).click();
		await expect(estimate.getByRole('textbox', { name: 'reps' })).toHaveValue('10');
		await expect(header.getByText('Forearms', { exact: true })).toBeVisible();

		await page.getByRole('radio', { name: 'Supinated' }).click();
		await expect(best).toContainText('10 × 6');
		await expect(estimate).toContainText(/\b12 kg/u);
		await expect(estimate.getByRole('textbox', { name: 'reps' })).toHaveValue('6');
		await expect(header.getByText('Biceps', { exact: true })).toBeVisible();
		await expect(header.getByText('Forearms', { exact: true })).toBeHidden();
		await expect(rows).toHaveCount(1);
		await expect(rows.first()).not.toContainText('Supinated');

		await page.getByRole('radio', { name: 'Pronated' }).click();
		await expect(best).toContainText('5 × 8');
		await expect(estimate).toContainText(/\b3 kg/u);
		await expect(estimate.getByRole('textbox', { name: 'reps' })).toHaveValue('6');
		await expect(header.getByText('Forearms', { exact: true })).toBeVisible();
		await expect(rows).toHaveCount(2);

		await page.getByRole('radio', { name: 'Neutral' }).click();
		await expect(best).toContainText('7.5 × 10');
		await expect(rows).toHaveCount(1);

		await page.getByRole('radio', { name: 'All', exact: true }).click();
		await expect(rows).toHaveCount(3);
	});
});

test.describe('the drawing follows the grip chip', () => {
	// Signed in, and nothing logged: the drawings are all there is to look at.
	test.beforeEach(async ({ account: _signedIn, page }) => {
		await page.goto('/plan/exercises');
	});

	for (const id of ['pull-up', 'triceps-pushdown', 'lat-pulldown']) {
		const exercise = catalogById[id];

		test(`${exercise.name}: one drawing per chip, never a blank`, async ({ page }) => {
			const axis = exercise.grips;
			if (axis === undefined) {
				throw new Error(`${id} has no grips`);
			}

			await page.goto(`/plan/exercises/${id}`);
			const shown = drawing(page, exercise.name);
			const opening = await svgOf(page, id);
			await expect(outline(shown)).toHaveAttribute('d', opening);
			const blanked = await watchForBlank(page, exercise.name);

			for (const value of axis.values) {
				// The default grip is what the exercise's own drawing shows; every other has its own.
				const svg = value.id === axis.default ? opening : await svgOf(page, `${id}--${value.id}`);
				await page.getByRole('radio', { name: value.label, exact: true }).click();
				await expect(outline(shown)).toHaveAttribute('d', svg);
			}

			expect(await blanked()).toBe(false);
		});
	}

	test('Triceps Pushdown opens on the rope', async ({ page }) => {
		await page.goto('/plan/exercises/triceps-pushdown');
		const shown = drawing(page, 'Triceps Pushdown');

		await expect(page.getByRole('radio', { name: 'All', exact: true })).toBeChecked();
		const opening = await svgOf(page, 'triceps-pushdown');
		await expect(outline(shown)).toHaveAttribute('d', opening);

		await page.getByRole('radio', { name: 'Rope', exact: true }).click();
		await page.getByRole('radio', { name: 'Straight Bar', exact: true }).click();
		await expect(outline(shown)).toHaveAttribute('d', await svgOf(page, 'triceps-pushdown--bar'));
		await page.getByRole('radio', { name: 'Rope', exact: true }).click();
		await expect(outline(shown)).toHaveAttribute('d', opening);
	});

	test('a drawing slow to arrive leaves the last one up meanwhile', async ({ page }) => {
		const { promise: held, resolve: release } = Promise.withResolvers<null>();
		await page.route('**/illustrations/pull-up--underhand.svg', async (route) => {
			await held;
			await route.continue();
		});

		await page.goto('/plan/exercises/pull-up');
		const shown = drawing(page, 'Pull-Up');
		const pronated = await svgOf(page, 'pull-up');
		await expect(outline(shown)).toHaveAttribute('d', pronated);
		const blanked = await watchForBlank(page, 'Pull-Up');

		const asked = page.waitForRequest('**/illustrations/pull-up--underhand.svg');
		await page.getByRole('radio', { name: 'Supinated' }).click();
		await asked;
		await expect(page.getByRole('radio', { name: 'Supinated' })).toBeChecked();
		await expect(outline(shown)).toHaveAttribute('d', pronated, { timeout: 1000 });

		release(null);
		const supinated = await svgOf(page, 'pull-up--underhand');
		await expect(outline(shown)).toHaveAttribute('d', supinated);
		expect(await blanked()).toBe(false);
	});
});
