import { APP_URL } from '../env.ts';
import { expect, test } from '../fixtures.ts';

test('the landing says what it is and where to get it', async ({ page }) => {
	await page.goto('/');

	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'A workout log fast enough to use between sets.'
	);
	await expect(page.getByRole('link', { name: 'Download for Android' })).toHaveAttribute(
		'href',
		'https://github.com/ilyasturki/kilorep/releases/latest'
	);
	const web = page.getByRole('link', { name: 'Use it on the web' });
	await expect(web).toHaveAttribute('href', '/login');

	await web.click();
	await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
});

test('a pasted link previews with a title, a description and a screenshot', async ({
	page,
	request
}) => {
	await page.goto('/');
	const meta = (key: string): ReturnType<typeof page.locator> =>
		page.locator(`meta[property="${key}"], meta[name="${key}"]`);

	await expect(page).toHaveTitle('Kilorep, a workout log that works offline');
	await expect(meta('og:title')).toHaveAttribute(
		'content',
		'Kilorep, a workout log that works offline'
	);
	const description = await meta('description').getAttribute('content');
	expect(description).toMatch(/^A workout log for Android and the web\./u);
	await expect(meta('og:description')).toHaveAttribute('content', description ?? '');
	await expect(meta('twitter:card')).toHaveAttribute('content', 'summary_large_image');
	await expect(meta('og:image')).toHaveAttribute('content', 'https://kilorep.com/og.png');

	const image = await request.get('/og.png');
	expect(image.status()).toBe(200);
	expect(image.headers()['content-type']).toBe('image/png');
	const png = await image.body();
	expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
});

test('a signed-in browser skips the landing for Train', async ({ page, account }) => {
	void account;
	await page.goto('/');
	await page.waitForURL('**/train');

	await page.goBack();
	await expect(page).not.toHaveURL(/\/$/u);
});

test('the app opens on Train, never the landing', async ({ page }) => {
	await page.goto(`${APP_URL}/`);
	await page.waitForURL(`${APP_URL}/train`);
});
