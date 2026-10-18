import { expect, test } from './fixtures.ts';
import { finish, logSet, startPlan, waitForSync } from './helpers.ts';

test.use({ seeded: true });

test('a set logged after signing in reaches History and the server', async ({
	account,
	browser,
	secondDevice
}) => {
	const phone = await browser.newContext();
	const page = await phone.newPage();

	await page.goto('/login');
	await page.getByRole('textbox', { name: 'Email' }).fill(account.email);
	await page.getByRole('textbox', { name: 'Password' }).fill(account.password);
	await page.getByRole('button', { name: 'Sign in' }).click();
	await page.waitForURL('**/train');

	await startPlan(page, 'Push Day');
	await logSet(page, { kg: 80, reps: 5 });
	const id = await finish(page);

	const bench = page.locator('section', {
		has: page.getByRole('heading', { name: 'Bench Press' })
	});
	await expect(page).toHaveTitle(/^Push Day /u);
	await expect(bench.getByRole('textbox', { name: 'Set 1 kg' })).toHaveValue('80');
	await expect(bench.getByRole('textbox', { name: 'Set 1 reps' })).toHaveValue('5');

	const today = page.getByRole('main').getByRole('link', { name: /^Push Day .* 1 set Today$/u });
	await page.goto('/history');
	await expect(today).toBeVisible();

	await waitForSync(page);
	await page.reload();
	await expect(today).toBeVisible();

	await secondDevice.goto('/history');
	await secondDevice
		.getByRole('main')
		.getByRole('link', { name: /^Push Day .* 1 set Today$/u })
		.click();
	await expect(secondDevice).toHaveURL(new RegExp(`/history/${id}$`, 'u'));
	await expect(
		secondDevice
			.locator('section', { has: secondDevice.getByRole('heading', { name: 'Bench Press' }) })
			.getByRole('textbox', { name: 'Set 1 kg' })
	).toHaveValue('80');

	await phone.close();
});
