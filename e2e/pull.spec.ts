import type { Page } from '@playwright/test';

import { APP_URL, WEB_URL } from './env.ts';
import { expect, test } from './fixtures.ts';
import { addExercise, openRecord, readStore, syncNow, waitForSync } from './helpers.ts';

async function expectHeld(page: Page, kind: string, text: string): Promise<void> {
	await expect
		.poll(async () => {
			const { records } = await readStore(page);

			return records.some(
				(record) => record.kind === kind && JSON.stringify(record.payload).includes(text)
			);
		})
		.toBe(true);
}

async function logWeight(page: Page, kg: number): Promise<void> {
	await page.goto('/bodyweight');
	const field = page.getByRole('textbox', { name: 'kg' });
	await field.fill(String(kg));
	await field.blur();
	await page.getByRole('button', { name: 'Log today’s weight' }).click();
	await expectHeld(page, 'bodyweight', `"kg":${kg}`);
	await waitForSync(page);
}

for (const [build, baseURL] of [
	['web', WEB_URL],
	['app', APP_URL]
] as const) {
	test.describe(`${build} build`, () => {
		test.use({ baseURL });

		test('a screen open during a pull redraws', async ({ page, secondDevice }) => {
			await page.goto('/bodyweight');
			await expect(page.getByRole('heading', { name: 'No weigh-ins yet' })).toBeVisible();

			await logWeight(secondDevice, 63.7);
			await syncNow(page);

			await expect(page.getByRole('heading', { name: 'No weigh-ins yet' })).toBeHidden();
			await expect(page.getByRole('main').getByText('63.7').first()).toBeVisible();
		});

		test('a redrawn screen keeps the grip picked on it', async ({ page, secondDevice }) => {
			await page.goto('/plan/exercises/bench-press');
			await page.getByRole('radio', { name: 'Close' }).click();

			await secondDevice.goto(`/plan/templates/${crypto.randomUUID()}`);
			await secondDevice.getByRole('textbox', { name: 'Template name' }).fill('Bench only');
			await addExercise(secondDevice, 'Bench Press');
			await expectHeld(secondDevice, 'template', '"bench-press"');
			await waitForSync(secondDevice);
			await syncNow(page);

			await expect(page.getByRole('link', { name: /^Bench only /u })).toBeVisible();
			await expect(page.getByRole('radio', { name: 'Close' })).toBeChecked();
		});

		test.describe(() => {
			test.use({ seeded: true });

			test('a pull leaves an edit in progress alone', async ({ page, secondDevice }) => {
				await openRecord(page, 'Push Day');
				const field = page.getByRole('main').getByRole('textbox', { name: 'Set 1 kg' }).first();
				await field.fill('123');
				await expect(page.getByRole('button', { name: 'SAVE', exact: true })).toBeVisible();

				await logWeight(secondDevice, 63.7);
				await syncNow(page);
				await expectHeld(page, 'bodyweight', '"kg":63.7');

				await expect(page.getByRole('button', { name: 'SAVE', exact: true })).toBeVisible();
				await expect(field).toBeFocused();
				await expect(field).toHaveValue('123');
			});
		});
	});
}
