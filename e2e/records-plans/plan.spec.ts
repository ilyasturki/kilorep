import type { Locator, Page } from '@playwright/test';

import type { Template } from '../../src/lib/domain/template.ts';

import { expect, test } from '../fixtures.ts';
import { bounds, logSet, startPlan } from '../helpers.ts';
import { plantRecords } from '../plant.ts';

import { held } from './records.ts';

test.use({ seeded: true });

const PUSH = 'seed-template-push';

// Asking for the account is what plants the seed on it.
test.beforeEach(async ({ page, account: _account }) => {
	await page.goto('/train');
});

type Rest = { shorten: Locator; lengthen: Locator; value: Locator; off: Locator; back: Locator };

function rest(page: Page, subject: string): Rest {
	const shorten = page.getByRole('button', { name: `Shorten rest ${subject}` });

	return {
		shorten,
		lengthen: page.getByRole('button', { name: `Lengthen rest ${subject}` }),
		value: shorten.locator('xpath=following-sibling::span[1]'),
		off: page.getByRole('button', { name: `No rest ${subject}` }),
		back: page.getByRole('button', {
			name: new RegExp(`^Back to the default rest ${subject}, `, 'u')
		})
	};
}

/** A phone plan shows one exercise's fields at a time, behind its card; a desk's ledger shows them all. */
async function openCard(page: Page, name: string): Promise<void> {
	await expect(page.getByRole('main').getByText(name, { exact: true }).first()).toBeVisible();

	const collapsed = page
		.getByRole('main')
		.getByRole('button', { name: new RegExp(`^${name} `, 'u'), expanded: false });

	if ((await collapsed.count()) > 0) {
		await collapsed.click();
		await expect(page.getByRole('button', { name: `Close ${name}` })).toBeVisible();
	}
}

async function stepTo(field: Rest, label: string): Promise<void> {
	for (let step = 0; step < 40; step += 1) {
		const shown = (await field.value.textContent()) ?? '';

		if (shown === label) {
			return;
		}

		const [minutes = '0', seconds = '0'] = shown.split(':');
		const [toMinutes = '0', toSeconds = '0'] = label.split(':');
		const longer =
			Number(toMinutes) * 60 + Number(toSeconds) > Number(minutes) * 60 + Number(seconds);
		const before = shown;

		await (longer ? field.lengthen : field.shorten).click();
		await expect(field.value).not.toHaveText(before);
	}

	throw new Error(`the rest could not step to ${label}`);
}

async function colour(locator: Locator): Promise<string> {
	const value = await locator.evaluate((element) => getComputedStyle(element).color);

	return value;
}

async function boxes(field: Rest): Promise<unknown[]> {
	const shorten = await bounds(field.shorten);
	const lengthen = await bounds(field.lengthen);

	return [shorten, lengthen];
}

test.describe('p1 · inline rest and plan default', () => {
	test('stepping, OFF and DEFAULT never move the arms; inherited reads faint, stated in ink', async ({
		page
	}) => {
		await page.goto(`/plan/templates/${PUSH}`);
		await openCard(page, 'Bench Press');

		const bench = rest(page, 'after Bench Press');
		await expect(bench.value).toHaveText('2:00');
		await expect(bench.off).toBeVisible();
		const still = await boxes(bench);
		const inherited = await colour(bench.value);

		await bench.lengthen.click();
		await expect(bench.value).toHaveText('2:15');
		await expect(bench.back).toBeVisible();
		await expect(bench.off).toHaveCount(0);
		expect(await boxes(bench)).toEqual(still);
		const stated = await colour(bench.value);
		expect(stated).not.toBe(inherited);

		await bench.shorten.click();
		await bench.shorten.click();
		await expect(bench.value).toHaveText('1:45');
		expect(await boxes(bench)).toEqual(still);

		await bench.back.click();
		await expect(bench.value).toHaveText('2:00');
		await expect(bench.off).toBeVisible();
		expect(await boxes(bench)).toEqual(still);
		expect(await colour(bench.value)).toBe(inherited);

		await bench.off.click();
		await expect(bench.value).toHaveText('Off');
		await expect(bench.shorten).toBeDisabled();
		await expect(bench.back).toBeVisible();
		expect(await boxes(bench)).toEqual(still);
		expect(await colour(bench.value)).toBe(stated);

		await bench.back.click();
		await expect(bench.value).toHaveText('2:00');
		expect(await boxes(bench)).toEqual(still);
		expect(await colour(bench.value)).toBe(inherited);

		const name = page.getByRole('main').getByText('Bench Press', { exact: true }).first();
		expect(stated).toBe(await colour(name));
	});

	test('closed rows show each exercise’s rest', { tag: '@phone' }, async ({ page }) => {
		await page.goto(`/plan/templates/${PUSH}`);
		await openCard(page, 'Overhead Press');
		await stepTo(rest(page, 'after Overhead Press'), '1:30');
		await page.getByRole('button', { name: 'Close Overhead Press' }).click();

		const main = page.getByRole('main');
		await expect(main.getByRole('button', { name: /^Overhead Press .* 1:30$/u })).toBeVisible();
		await expect(main.getByRole('button', { name: /^Bench Press .* 2:00$/u })).toBeVisible();

		await stepTo(rest(page, 'in this plan'), '2:45');
		await expect(main.getByRole('button', { name: /^Bench Press .* 2:45$/u })).toBeVisible();
		await expect(main.getByRole('button', { name: /^Overhead Press .* 1:30$/u })).toBeVisible();
	});

	test('a started workout rests by the plan default where nothing nearer says otherwise', async ({
		page
	}) => {
		await page.clock.install();
		await page.goto(`/plan/templates/${PUSH}`);

		await expect(page.getByText('From Settings')).toBeVisible();
		await stepTo(rest(page, 'in this plan'), '2:45');
		await expect(page.getByText('Whole plan')).toBeVisible();

		await openCard(page, 'Overhead Press');
		await stepTo(rest(page, 'after Overhead Press'), '1:30');

		await expect
			.poll(async () => {
				const plan = await held<Template>(page, PUSH);
				const ohp = plan === null ? undefined : plan.entries[1].exercises[0];
				const planRest = await held<{ seconds: number | null }>(page, `plan-rest:${PUSH}`);

				return [
					ohp === undefined ? null : ohp.restSeconds,
					planRest === null ? null : planRest.seconds
				];
			})
			.toEqual([90, 165]);

		await startPlan(page, 'Push Day');
		await page.clock.pauseAt(Date.now() + 60_000);

		const chip = page.getByRole('banner').getByRole('button', { name: /^Rest timer, /u });

		await logSet(page);
		await expect(chip).toHaveAccessibleName(/^Rest timer, 2:45\./u);

		await page.getByRole('img', { name: 'set 1 pending' }).first().click();
		await logSet(page);
		await expect(chip).toHaveAccessibleName(/^Rest timer, 1:30\./u);

		await page.clock.runFor(30_000);
		await expect(chip).toHaveAccessibleName(/^Rest timer, 1:00\./u);
	});
});

function longPlan(id: string): Template {
	const exercises = [
		'squat',
		'romanian-deadlift',
		'leg-press',
		'leg-curl',
		'standing-calf-raise',
		'bench-press',
		'overhead-press',
		'barbell-row',
		'pull-up',
		'lateral-raise',
		'face-pull',
		'hammer-curl'
	];

	return {
		id,
		name: 'Long plan',
		createdAt: Date.now() - 86_400_000,
		entries: exercises.map((exerciseId, at) => ({
			id: `${id}-e${at}`,
			exercises: [
				{
					id: `${id}-x${at}`,
					exerciseId,
					sets: [0, 1, 2].map((set) => ({ id: `${id}-x${at}-s${set}`, plannedReps: 10 }))
				}
			]
		}))
	};
}

test.describe('p2 · name in the bar, and the Plan segment', { tag: '@phone' }, () => {
	test('the plan’s name shows in the bar only once its field is gone, typing included', async ({
		page,
		account,
		db
	}) => {
		const id = `long-${crypto.randomUUID()}`;
		await plantRecords(db, account.id, page, [
			{ kind: 'template', payload: longPlan(id), updatedAt: Date.now() - 86_400_000 }
		]);
		await page.goto(`/plan/templates/${id}`);

		const field = page.getByRole('textbox', { name: 'Template name' });
		const title = page.getByRole('banner').getByRole('heading', { level: 1 });
		const last = page.getByRole('button', { name: 'Options for Hammer Curl' });

		await expect(field).toBeInViewport();
		await expect(title).toHaveCount(0);

		await last.scrollIntoViewIfNeeded();
		await expect(field).not.toBeInViewport();
		await expect(title).toHaveText('Long plan');

		await field.scrollIntoViewIfNeeded();
		await expect(field).toBeInViewport();
		await expect(title).toHaveCount(0);

		await field.click();
		await page.keyboard.press('End');
		await page.keyboard.type(' B');
		await expect(field).toHaveValue('Long plan B');
		await expect(title).toHaveCount(0);

		await last.scrollIntoViewIfNeeded();
		await expect(field).not.toBeInViewport();
		await expect(title).toHaveText('Long plan B');
	});

	test('the Templates | Exercises segment stays put while the list scrolls', async ({ page }) => {
		await page.goto('/plan/exercises');

		const main = page.getByRole('main');
		const segment = page.getByRole('banner').getByRole('toolbar', { name: 'Plan' });
		await expect(segment.getByRole('link', { name: 'Exercises' })).toBeVisible();
		const before = await bounds(segment);

		const first = main.getByRole('link').first();
		await expect(first).toBeInViewport();
		await main.hover();
		await page.mouse.wheel(0, 4000);
		await expect(first).not.toBeInViewport();

		await expect(segment).toBeInViewport();
		expect(await bounds(segment)).toEqual(before);
	});
});
