import type { Page } from '@playwright/test';

import { expect, test } from '../fixtures.ts';
import { finish, logSet, startPlan } from '../helpers.ts';

type Via = '‹' | 'system';

const RECORD = /\/history\/[^/]+$/u;

function at(page: Page): string {
	const { pathname, search } = new URL(page.url());

	return `${pathname}${search}`;
}

async function back(page: Page, via: Via): Promise<void> {
	const from = page.url();

	await (via === 'system'
		? page.goBack()
		: page.getByRole('banner').getByRole('link', { name: 'Back', exact: true }).click());

	await expect.poll(() => page.url()).not.toBe(from);
}

async function backTo(page: Page, via: Via, pathname: string): Promise<void> {
	await back(page, via);
	await expect.poll(() => new URL(page.url()).pathname).toBe(pathname);
}

// The way a launcher shortcut lands: a `goto` pushed over whatever is on screen.
async function pushFromApp(page: Page, href: string): Promise<void> {
	await page.evaluate((target) => {
		const link = document.createElement('a');
		link.href = target;
		document.body.append(link);
		link.click();
		link.remove();
	}, href);
	await page.waitForURL(`**${href}`);
}

// The address moves before the record is drawn, and the session's bar holds a ‹ of its own.
async function finishOnRecord(page: Page): Promise<string> {
	const id = await finish(page);
	await expect(page.getByRole('button', { name: 'Workout options' })).toBeVisible();

	return id;
}

/** Every title, or every slide stamped on <html>, from the first paint of each load on. */
async function watch(page: Page, what: 'title' | 'slide'): Promise<() => Promise<string[]>> {
	await page.addInitScript((kind) => {
		const seen: string[] = [];
		Object.assign(globalThis, { seen });

		// `document`, not <html>: an init script runs before the root element exists.
		new MutationObserver(() => {
			const value = kind === 'title' ? document.title : document.documentElement.dataset.nav;

			if (value !== undefined) {
				seen.push(value);
			}
		}).observe(
			document,
			kind === 'title'
				? { subtree: true, childList: true, characterData: true }
				: { subtree: true, attributeFilter: ['data-nav'] }
		);
	}, what);

	return async () => {
		const seen: unknown = await page.evaluate((): unknown => Reflect.get(globalThis, 'seen'));

		return Array.isArray(seen) ? seen.map(String) : [];
	};
}

test.use({ seeded: true });

// A seeded launch and up to seven navigations, which a loaded runner takes past the default 30 s.
test.describe.configure({ timeout: 60_000 });

for (const via of ['‹', 'system'] as const) {
	test.describe(`back by ${via}`, () => {
		test('a workout opened from Progress walks back to History, then Progress', async ({
			page,
			account
		}) => {
			void account;
			await page.goto('/progress');
			await page.getByRole('link', { name: /^Training frequency /u }).click();
			await page.waitForURL('**/history');
			await page
				.getByRole('main')
				.getByRole('link', { name: /^Push Day /u })
				.first()
				.click();
			await page.waitForURL(RECORD);

			await backTo(page, via, '/history');
			await backTo(page, via, '/progress');
		});

		test('a session started from a plan walks back to its editor', async ({ page, account }) => {
			void account;
			await page.goto('/plan/templates');
			await page
				.getByRole('main')
				.getByRole('link', { name: /^Leg Day /u })
				.click();
			await page.waitForURL('**/plan/templates/seed-template-legs');
			await page.getByRole('button', { name: 'Start workout' }).click();
			await page.waitForURL('**/train/live');

			await backTo(page, via, '/plan/templates/seed-template-legs');
			await backTo(page, via, '/plan/templates');
		});

		test('an exercise viewed mid-session walks back into the session', async ({
			page,
			account
		}) => {
			void account;
			await startPlan(page, 'Pull Day');
			await page.getByRole('button', { name: 'Deadlift options' }).click();
			await page
				.getByRole('menuitem', { name: 'View exercise' })
				.or(page.getByRole('link', { name: 'View exercise' }))
				.click();
			await page.waitForURL('**/plan/exercises/deadlift?**');

			await backTo(page, via, '/train/live');
			await backTo(page, via, '/train');
			await expect(
				page.getByRole('main').getByRole('link', { name: 'RESUME', exact: true })
			).toBeVisible();
		});

		test('"Add to this workout" walks back to the list it was found in', async ({
			page,
			account
		}) => {
			void account;
			await startPlan(page, 'Pull Day');
			await backTo(page, via, '/train');
			await page.getByRole('link', { name: 'Plan', exact: true }).click();
			await page.getByRole('link', { name: 'Exercises', exact: true }).click();
			await page.waitForURL('**/plan/exercises');
			await page
				.getByRole('searchbox')
				.or(page.getByRole('textbox', { name: /search/iu }))
				.fill('Preacher Curl');
			await page
				.getByRole('main')
				.getByRole('link', { name: /^Preacher Curl/u })
				.first()
				.click();
			await page.waitForURL('**/plan/exercises/preacher-curl**');
			await page.getByRole('button', { name: 'Add to this workout' }).click();
			await page.waitForURL('**/train/live');
			await expect(page.getByRole('main').getByText('Preacher Curl').first()).toBeVisible();

			await backTo(page, via, '/plan/exercises');
		});

		test('a deleted workout is never walked back into', async ({ page, account }) => {
			void account;
			await page.goto('/progress');
			await page.getByRole('link', { name: /^Training frequency /u }).click();
			await page
				.getByRole('main')
				.getByRole('link', { name: /^Push Day /u })
				.first()
				.click();
			await page.waitForURL(RECORD);
			const deleted = at(page);

			await page.getByRole('button', { name: 'Workout options' }).click();
			await page
				.getByRole('menuitem', { name: 'Delete workout' })
				.or(page.getByRole('button', { name: 'Delete workout' }))
				.click();
			await page
				.getByRole('alertdialog')
				.getByRole('button', { name: 'Delete', exact: true })
				.click();
			await page.waitForURL('**/history');

			await backTo(page, via, '/progress');
			expect(at(page)).not.toBe(deleted);
		});

		test('a deleted plan is never walked back into', async ({ page, account }) => {
			void account;
			await page.goto('/plan/templates');
			await page
				.getByRole('main')
				.getByRole('link', { name: /^Arms /u })
				.click();
			await page.waitForURL('**/plan/templates/seed-template-arms');

			await page.getByRole('button', { name: 'Delete template' }).click();
			await page
				.getByRole('alertdialog')
				.getByRole('button', { name: 'Delete', exact: true })
				.click();
			await page.waitForURL('**/plan/templates');
			await expect(page.getByRole('main').getByRole('link', { name: /^Arms /u })).toBeHidden();

			if (via === 'system') {
				await page.goBack();
				await expect.poll(() => at(page)).not.toBe('/plan/templates/seed-template-arms');
			} else {
				await expect(page.getByRole('banner').getByRole('link', { name: 'Back' })).toBeHidden();
			}
		});

		test('Weight opened from a running session walks back into it', async ({ page, account }) => {
			void account;
			await startPlan(page, 'Pull Day');
			await pushFromApp(page, '/bodyweight');

			await backTo(page, via, '/train/live');
		});

		test('a finished session walks back to its record, History, then Train', async ({
			page,
			account
		}) => {
			void account;
			await startPlan(page, 'Pull Day');
			await logSet(page);
			await finishOnRecord(page);

			await backTo(page, via, '/history');
			await backTo(page, via, '/train');
			await expect(page.getByRole('main').getByRole('link', { name: 'RESUME' })).toBeHidden();
		});

		test('a session finished from the plan editor walks back to the editor', async ({
			page,
			account
		}) => {
			void account;
			await page.goto('/plan/templates');
			await page
				.getByRole('main')
				.getByRole('link', { name: /^Pull Day /u })
				.click();
			await page.waitForURL('**/plan/templates/seed-template-pull');
			await page.getByRole('button', { name: 'Start workout' }).click();
			await page.waitForURL('**/train/live');
			await logSet(page);
			await finishOnRecord(page);

			await backTo(page, via, '/history');
			await backTo(page, via, '/plan/templates/seed-template-pull');
			await backTo(page, via, '/plan/templates');
		});

		test('History after a finish still walks to the origin once reloaded', async ({
			page,
			account
		}) => {
			void account;
			await startPlan(page, 'Pull Day');
			await logSet(page);
			await finishOnRecord(page);
			await backTo(page, via, '/history');

			await page.reload();
			await expect(
				page
					.getByRole('main')
					.getByRole('link', { name: /^Pull Day /u })
					.first()
			).toBeVisible();
			await backTo(page, via, '/train');
		});

		test('a finished workout, deleted, never comes back', async ({ page, account }) => {
			void account;
			await startPlan(page, 'Pull Day');
			await logSet(page);
			const id = await finishOnRecord(page);

			await page.getByRole('button', { name: 'Workout options' }).click();
			await page
				.getByRole('menuitem', { name: 'Delete workout' })
				.or(page.getByRole('button', { name: 'Delete workout' }))
				.click();
			await page
				.getByRole('alertdialog')
				.getByRole('button', { name: 'Delete', exact: true })
				.click();
			await page.waitForURL('**/history?**');

			const record = page.getByRole('main').getByRole('textbox', { name: 'Set 1 kg' });
			await expect(record).toHaveCount(0);
			await page.goForward();
			await page.waitForURL(`**/history/${id}`);
			await expect(page.getByText('No such workout')).toBeVisible();
			await expect(record).toHaveCount(0);

			await backTo(page, via, '/history');
			await backTo(page, via, '/train');
			await expect(record).toHaveCount(0);
		});
	});
}

test('FINISH draws the record without History on the way', async ({ page, account }) => {
	void account;
	const titles = await watch(page, 'title');

	await startPlan(page, 'Pull Day');
	await logSet(page);
	await finishOnRecord(page);
	await expect(page).toHaveTitle(/^Pull Day /u);

	expect(await titles()).toContain('Pull Day | Kilorep');
	expect(await titles()).not.toContain('History | Kilorep');
});

test('History opened cold walks to the origin it names, or else up to Progress', async ({
	page,
	account
}) => {
	void account;
	await page.goto('/history?from=%2Fplan%2Ftemplates%2Fseed-template-pull');
	await expect(
		page
			.getByRole('main')
			.getByRole('link', { name: /^Pull Day /u })
			.first()
	).toBeVisible();
	await backTo(page, '‹', '/plan/templates/seed-template-pull');

	await page.goto('/history');
	await expect(
		page
			.getByRole('main')
			.getByRole('link', { name: /^Pull Day /u })
			.first()
	).toBeVisible();
	await backTo(page, '‹', '/progress');
});

test('a tab root offers no back, unless it was glanced at from a running session', async ({
	page,
	account
}) => {
	void account;
	const bar = page.getByRole('banner').getByRole('link', { name: 'Back', exact: true });

	for (const tab of ['/train', '/plan/templates', '/progress', '/bodyweight', '/settings']) {
		await page.goto(tab);
		await expect(page.getByRole('main')).toBeVisible();
		await expect(bar).toBeHidden();
	}

	await startPlan(page, 'Pull Day');
	await pushFromApp(page, '/bodyweight');
	await expect(bar).toHaveAttribute('href', '/train/live');
});

test(
	'every back slides like a pop, the ones that replace included',
	{ tag: '@phone' },
	async ({ page, account }) => {
		void account;
		const slides = await watch(page, 'slide');

		await page.goto('/progress');
		await page.getByRole('link', { name: /^Training frequency /u }).click();
		await page
			.getByRole('main')
			.getByRole('link', { name: /^Push Day /u })
			.first()
			.click();
		await page.waitForURL(RECORD);
		const record = at(page);
		await expect.poll(slides).toEqual(['push', 'push']);

		await backTo(page, '‹', '/history');
		await backTo(page, '‹', '/progress');
		await expect.poll(slides).toEqual(['push', 'push', 'pop', 'pop']);

		// Opened cold, nothing of ours is behind the record: ‹ replaces it with History.
		await page.goto(record);
		await expect(page.getByRole('heading', { name: 'Push Day', level: 1 })).toBeVisible();
		await backTo(page, '‹', '/history');
		await expect.poll(slides).toEqual(['pop']);
	}
);

test(
	'‹ with the ⋮ menu open closes it and goes back within two clicks',
	{ tag: '@desk' },
	async ({ page, account }) => {
		void account;
		await page.goto('/history');
		await page
			.getByRole('main')
			.getByRole('link', { name: /^Push Day /u })
			.first()
			.click();
		await page.waitForURL(RECORD);

		await page.getByRole('button', { name: 'Workout options' }).click();
		const menu = page.getByRole('menu');
		await expect(menu).toBeVisible();

		const box = await page
			.getByRole('banner')
			.getByRole('link', { name: 'Back', exact: true })
			.boundingBox();
		if (box === null) {
			throw new Error('‹ is not on screen');
		}

		await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
		await expect(menu).toBeHidden();

		const once = await page.waitForURL('**/history', { timeout: 2000 }).then(
			() => true,
			() => false
		);
		test
			.info()
			.annotations.push({ type: '‹ over a menu', description: once ? 'one click' : 'two' });

		if (!once) {
			await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
		}

		await expect.poll(() => new URL(page.url()).pathname).toBe('/history');
	}
);
