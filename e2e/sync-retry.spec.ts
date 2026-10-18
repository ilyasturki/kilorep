import type { Page } from '@playwright/test';

import { APP_URL, WEB_URL } from './env.ts';
import { expect, test } from './fixtures.ts';
import { readStore, waitForSync } from './helpers.ts';

const FIRST_RUNG_MS = 5000;

async function logWeight(page: Page, kg: number): Promise<void> {
	await page.goto('/bodyweight');
	const field = page.getByRole('textbox', { name: 'kg' });
	await field.fill(String(kg));
	await field.blur();
	await page.getByRole('button', { name: 'Log today’s weight' }).click();
	await expect
		.poll(async () => {
			const { records } = await readStore(page);

			return records.some(
				(record) =>
					record.kind === 'bodyweight' && JSON.stringify(record.payload).includes(`"kg":${kg}`)
			);
		})
		.toBe(true);
	await waitForSync(page);
}

for (const [build, baseURL] of [
	['web', WEB_URL],
	['app', APP_URL]
] as const) {
	test.describe(`${build} build`, () => {
		test.use({ baseURL });

		test('a launch pull the server did not answer is tried again on its own', async ({
			page,
			secondDevice
		}) => {
			let refused = 0;
			await page.route('**/api/sync', async (route) => {
				refused += 1;
				await route.abort('connectionrefused');
			});
			await page.clock.install();

			await page.goto('/bodyweight');
			await expect(page.getByRole('heading', { name: 'No weigh-ins yet' })).toBeVisible();
			await expect.poll(() => refused).toBeGreaterThan(0);

			// Paused, the rung can only fire when the test says so, however long the second device takes.
			await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 100);

			await logWeight(secondDevice, 63.7);
			await page.unroute('**/api/sync');

			await page.clock.runFor(FIRST_RUNG_MS);
			await page.clock.resume();

			await expect(page.getByRole('main').getByText('63.7').first()).toBeVisible();
			expect(refused).toBe(1);
		});
	});
}
