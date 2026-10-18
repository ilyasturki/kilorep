import type { Locator, Page } from '@playwright/test';

import type { FinishedWorkout } from '../../src/lib/store/derive.ts';

import { expect, test } from '../fixtures.ts';
import { openRecord, waitForSync } from '../helpers.ts';
import { plantRecords } from '../plant.ts';

import { beginEdit, held } from './records.ts';

test.use({ seeded: true });

// Asking for the account is what plants the seed on it.
test.beforeEach(async ({ page, account: _account }) => {
	await page.goto('/train');
});

function header(page: Page): Locator {
	return page.getByRole('main').getByRole('paragraph').first();
}

function figure(page: Page, name: string): Locator {
	return page.getByRole('main').getByRole('textbox', { name, exact: true }).first();
}

function bar(page: Page, name: string): Locator {
	return page.getByRole('banner').getByRole('button', { name, exact: true });
}

async function expectAllSelected(field: Locator): Promise<void> {
	await expect(field).toBeFocused();
	await expect
		.poll(async () => {
			const all = await field.evaluate(
				(input: HTMLInputElement) =>
					input.value.length > 0 &&
					input.selectionStart === 0 &&
					input.selectionEnd === input.value.length
			);

			return all;
		})
		.toBe(true);
}

test.describe('h2 · edit a record in place', () => {
	test('a tapped number is selected under a decimal keypad, reps get none, and next walks on', async ({
		page
	}) => {
		await openRecord(page, 'Push Day');

		const kg = figure(page, 'Set 1 kg');
		const reps = figure(page, 'Set 1 reps');

		await expect(kg).toHaveAttribute('inputmode', 'decimal');
		await expect(kg).toHaveAttribute('enterkeyhint', 'next');
		await expect(reps).toHaveAttribute('inputmode', 'numeric');
		await expect(reps).toHaveAttribute('enterkeyhint', 'next');

		await kg.click();
		await expectAllSelected(kg);
		await expect(bar(page, 'SAVE')).toBeVisible();

		await page.keyboard.press('Enter');
		await expectAllSelected(reps);

		await page.keyboard.press('Enter');
		await expectAllSelected(figure(page, 'Set 2 kg'));
	});

	test('a saved number sticks after a reload and on another device, and nothing else changes', async ({
		page,
		secondDevice
	}) => {
		const id = await openRecord(page, 'Push Day');
		const before = await held<FinishedWorkout>(page, id);
		if (before === null) {
			throw new Error('the record is not on the device');
		}

		const kg = figure(page, 'Set 1 kg');
		await kg.click();
		await page.keyboard.type('82.5');
		await bar(page, 'SAVE').click();
		await expect(bar(page, 'SAVE')).toBeHidden();
		await expect(kg).toHaveValue('82.5');

		const [bench] = before.entries[0].exercises;
		const edited = bench.sets.find((set) => set.type === 'normal');
		if (edited === undefined) {
			throw new Error('Bench Press has no working set');
		}

		await expect
			.poll(async () => {
				const after = await held<FinishedWorkout>(page, id);

				return after === null ? null : after.entries[0].exercises[0].sets[1].weight;
			})
			.toBe(82.5);

		const after = await held<FinishedWorkout>(page, id);
		if (after === null) {
			throw new Error('the record left the device');
		}

		const expected = structuredClone(before);
		const set = expected.entries[0].exercises[0].sets.find(({ id: setId }) => setId === edited.id);
		if (set === undefined) {
			throw new Error('the edited set left the record');
		}

		set.weight = 82.5;
		// Stating a number is what marks a set as typed; nothing else on it moves.
		const typed = after.entries[0].exercises[0].sets.find(({ id: setId }) => setId === edited.id);
		if (typed !== undefined && typed.entered === true) {
			set.entered = true;
		}

		expect(after).toEqual(expected);

		await page.reload();
		await expect(figure(page, 'Set 1 kg')).toHaveValue('82.5');

		await waitForSync(page);
		await openRecord(secondDevice, 'Push Day');
		await expect(secondDevice).toHaveURL(new RegExp(`/history/${id}$`, 'u'));
		await expect(figure(secondDevice, 'Set 1 kg')).toHaveValue('82.5');
		await expect(figure(secondDevice, 'Set 1 reps')).toHaveValue(String(edited.reps));
	});

	test('another date keeps the start time and the length', async ({ page }) => {
		const id = await openRecord(page, 'Push Day');
		const before = await held<FinishedWorkout>(page, id);
		if (before === null) {
			throw new Error('the record is not on the device');
		}

		const shown = await header(page).textContent();
		const [, tail] = /^[^·]+ · (?<tail>.+)$/u.exec(shown ?? '') ?? [];
		expect(tail).toMatch(/^\d{2}:\d{2} · 1 h 2 min/u);

		const target = await page.evaluate((startedAt) => {
			const day = new Date(startedAt);
			day.setDate(day.getDate() === 1 ? 2 : day.getDate() - 1);

			return {
				label: day.toLocaleDateString('en-US', {
					weekday: 'long',
					month: 'long',
					day: 'numeric',
					year: 'numeric'
				}),
				header: day.toLocaleDateString('en-US', {
					weekday: 'short',
					month: 'short',
					day: 'numeric',
					year: 'numeric'
				}),
				startedAt: day.getTime()
			};
		}, before.startedAt);

		await beginEdit(page);
		await page.getByRole('main').getByRole('button', { name: 'Date' }).click();
		await page.getByRole('button', { name: target.label, exact: true }).click();
		await bar(page, 'SAVE').click();
		await expect(bar(page, 'SAVE')).toBeHidden();

		await expect(header(page)).toHaveText(`${target.header} · ${tail}`);

		await expect
			.poll(async () => {
				const after = await held<FinishedWorkout>(page, id);

				return after === null ? null : [after.startedAt, after.finishedAt - after.startedAt];
			})
			.toEqual([target.startedAt, before.finishedAt - before.startedAt]);
	});
});

test.describe('h3 · back while editing', () => {
	test('back with a change asks before discarding it', async ({ page }) => {
		const id = await openRecord(page, 'Push Day');
		const kg = figure(page, 'Set 1 kg');
		const was = await kg.inputValue();

		await kg.click();
		await page.keyboard.type('99');

		const ask = page.getByRole('alertdialog', { name: 'Discard your changes?' });

		await page.goBack();
		await expect(ask).toBeVisible();
		await ask.getByRole('button', { name: 'Cancel' }).click();
		await expect(ask).toBeHidden();
		await expect(bar(page, 'SAVE')).toBeVisible();
		await expect(kg).toHaveValue('99');
		await expect(page).toHaveURL(new RegExp(`/history/${id}$`, 'u'));

		await page.goBack();
		await expect(ask).toBeVisible();
		await ask.getByRole('button', { name: 'Discard', exact: true }).click();
		await expect(bar(page, 'SAVE')).toBeHidden();
		await expect(page).toHaveURL(new RegExp(`/history/${id}$`, 'u'));
		await expect(kg).toHaveValue(was);
	});

	test('‹ with a change asks too', async ({ page }) => {
		await openRecord(page, 'Push Day');
		await figure(page, 'Set 1 kg').click();
		await page.keyboard.type('99');

		await page.getByRole('banner').getByRole('link', { name: 'Back' }).click();
		await expect(page.getByRole('alertdialog', { name: 'Discard your changes?' })).toBeVisible();
	});

	test('back with nothing changed just stops editing', async ({ page }) => {
		const id = await openRecord(page, 'Push Day');
		await beginEdit(page);

		await page.goBack();
		await expect(bar(page, 'SAVE')).toBeHidden();
		await expect(page.getByRole('alertdialog')).toHaveCount(0);
		await expect(page).toHaveURL(new RegExp(`/history/${id}$`, 'u'));
		await expect(
			page.getByRole('banner').getByRole('button', { name: 'Workout options' })
		).toBeVisible();
	});
});

test.describe('h4 · the record’s bar', { tag: '@phone' }, () => {
	test('holds only ‹, the name and ⋮, and ⋮ holds the rest', async ({ page }) => {
		await openRecord(page, 'Push Day');

		const banner = page.getByRole('banner');
		await expect(banner.getByRole('link')).toHaveCount(1);
		await expect(banner.getByRole('link', { name: 'Back' })).toBeVisible();
		await expect(banner.getByRole('heading', { level: 1 })).toHaveText('Push Day');
		await expect(banner.getByRole('button')).toHaveCount(1);

		await bar(page, 'Workout options').click();
		const menu = page.getByRole('dialog', { name: 'Push Day' });
		await expect(menu.getByRole('button')).toHaveText([
			'Repeat workout',
			'Edit workout',
			'Change plan',
			'Delete workout'
		]);

		await menu.getByRole('button', { name: 'Edit workout' }).click();
		await expect(page.getByRole('alertdialog')).toHaveCount(0);
		await expect(banner.getByRole('button')).toHaveText(['DISCARD', 'SAVE']);
	});

	test('a record with no plan offers Link to a plan, and Repeat starts the session', async ({
		page
	}) => {
		await openRecord(page, 'Bench Press + 4 more');

		await bar(page, 'Workout options').click();
		await expect(page.getByRole('dialog').getByRole('button')).toHaveText([
			'Repeat workout',
			'Edit workout',
			'Link to a plan',
			'Save as a new plan',
			'Delete workout'
		]);

		await page.getByRole('dialog').getByRole('button', { name: 'Repeat workout' }).click();
		await page.waitForURL('**/train/live');
		await expect(
			page.getByRole('main').getByText('Bench Press', { exact: true }).first()
		).toBeVisible();
	});
});

test.describe('z2 · a real past workout’s header', () => {
	test.use({ timezoneId: 'Europe/Paris' });

	test('a v1 session with no length reads date · time, a recent one adds its length', async ({
		page,
		account,
		db
	}) => {
		const id = `v1-${crypto.randomUUID()}`;
		const startedAt = Date.UTC(2026, 6, 15, 16, 30);
		const imported: FinishedWorkout = {
			id,
			templateId: null,
			startedAt,
			finishedAt: startedAt,
			entries: ['squat', 'bench-press', 'barbell-row'].map((exerciseId, at) => ({
				id: `${id}-e${at}`,
				exercises: [
					{
						id: `${id}-x${at}`,
						exerciseId,
						sets: [
							{
								id: `${id}-x${at}-s0`,
								type: 'normal',
								plannedReps: null,
								weight: 60,
								reps: 8,
								rpe: null,
								completed: true
							}
						]
					}
				]
			}))
		};
		// Imported before the key existed.
		Reflect.deleteProperty(imported, 'templateId');

		await plantRecords(db, account.id, page, [
			{ kind: 'workout', payload: imported, updatedAt: Date.UTC(2026, 7, 1) }
		]);

		await openRecord(page, 'Squat + 2 more');
		await expect(page).toHaveURL(new RegExp(`/history/${id}$`, 'u'));
		await expect(header(page)).toHaveText('Wed, Jul 15, 2026 · 18:30');

		await openRecord(page, 'Push Day');
		await expect(header(page)).toHaveText(
			/^[A-Z][a-z]{2}, [A-Z][a-z]{2} \d{1,2}, \d{4} · \d{2}:\d{2} · 1 h 2 min · as planned$/u
		);
	});
});
