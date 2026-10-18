import type { Locator, Page } from '@playwright/test';

import type { Template, TemplateExercise } from '../../src/lib/domain/template.ts';
import type { FinishedWorkout } from '../../src/lib/store/derive.ts';

import { expect, test } from '../fixtures.ts';
import {
	addExercise,
	finish,
	logSet,
	openRecord,
	readStore,
	startPlan,
	syncNow,
	waitForSync
} from '../helpers.ts';
import { plantRecords } from '../plant.ts';

import { held } from './records.ts';

test.use({ seeded: true });

// Asking for the account is what plants the seed on it.
test.beforeEach(async ({ page, account: _account }) => {
	await page.goto('/train');
});

const PUSH = 'seed-template-push';
const LEGS = 'seed-template-legs';

function offer(page: Page): Locator {
	return page.getByRole('main').getByRole('region', { name: 'Update the plan' });
}

function saveOffer(page: Page): Locator {
	return page.getByRole('main').getByRole('region', { name: 'Save as a plan' });
}

async function removeFromSession(page: Page, name: string): Promise<void> {
	await page.getByRole('button', { name: `${name} options` }).click();
	await page
		.getByRole('menuitem', { name: 'Remove exercise' })
		.or(page.getByRole('button', { name: 'Remove exercise' }))
		.click();
	await expect(page.getByRole('main').getByText(name, { exact: true })).toHaveCount(0);
}

function exercisesOf(template: Template): TemplateExercise[] {
	return template.entries.flatMap((entry) => entry.exercises);
}

test.describe('h1 · the plan offer after a real workout', () => {
	test('FINISH asks nothing about the plan; the record offers it, and Update copies structure only', async ({
		page
	}) => {
		const before = await held<Template>(page, PUSH);
		expect(before).not.toBeNull();

		await startPlan(page, 'Push Day');
		await logSet(page);
		await page.getByRole('button', { name: 'Add set' }).first().click();
		await removeFromSession(page, 'Triceps Pushdown');
		await addExercise(page, 'Cable Crunch');
		await logSet(page, { kg: 25, reps: 15 });

		await page.getByRole('banner').getByRole('button', { name: 'FINISH', exact: true }).click();
		const owed = page.getByRole('alertdialog');
		await expect(owed).toBeVisible();
		await expect(owed).not.toContainText(/plan|update|differ/iu);
		await owed.getByRole('button', { name: 'Finish', exact: true }).click();
		await page.waitForURL(/\/history\/[^/]+$/u);

		const banner = offer(page);
		await expect(banner).toBeVisible();
		await expect(banner).not.toHaveAttribute('role', 'alert');
		await expect(banner.getByRole('heading')).toHaveText('This workout differed from Push Day');
		await expect(banner.getByRole('paragraph')).toHaveText(
			'Bench Press +1 set · Cable Crunch added · Triceps Pushdown not done'
		);
		await expect(banner.getByRole('button', { name: 'Dismiss' })).toBeVisible();

		await banner.getByRole('button', { name: 'Update Push Day' }).click();
		await expect(page.getByRole('main').getByRole('status')).toHaveText('Push Day updated.');
		await expect(banner).toBeHidden();

		await expect
			.poll(async () => {
				const plan = await held<Template>(page, PUSH);

				return plan === null ? [] : exercisesOf(plan).map(({ exerciseId }) => exerciseId);
			})
			.toEqual([
				'bench-press',
				'overhead-press',
				'incline-dumbbell-press',
				'lateral-raise',
				'cable-crunch'
			]);

		const after = await held<Template>(page, PUSH);
		if (before === null || after === null) {
			throw new Error('Push Day left the device');
		}

		expect(after.name).toBe(before.name);
		expect(after.order).toBe(before.order);
		expect(JSON.stringify(after)).not.toMatch(/"weight"/u);

		const [benchBefore, ...othersBefore] = exercisesOf(before);
		const [benchAfter, ...othersAfter] = exercisesOf(after);

		expect(benchAfter.sets).toHaveLength(benchBefore.sets.length + 1);
		expect(benchAfter.sets.slice(0, benchBefore.sets.length)).toEqual(benchBefore.sets);
		const [lastBefore] = benchBefore.sets.slice(-1);
		const [added] = benchAfter.sets.slice(-1);
		expect(added.plannedReps).toBe(lastBefore.plannedReps);
		expect(othersAfter.slice(0, 3)).toEqual(othersBefore.slice(0, 3));
	});

	test('editing the plan after starting withdraws the offer', async ({ page }) => {
		await startPlan(page, 'Push Day');
		await logSet(page);
		await page.getByRole('button', { name: 'Add set' }).first().click();

		await page.goto(`/plan/templates/${PUSH}`);
		await page.getByRole('textbox', { name: 'Template name' }).fill('Push Day A');
		await expect
			.poll(async () => {
				const plan = await held<Template>(page, PUSH);

				return plan === null ? null : plan.name;
			})
			.toBe('Push Day A');

		await page.goto('/train/live');
		await finish(page);

		await expect(page.getByRole('main').getByText('+1 set')).toBeVisible();
		await expect(offer(page)).toHaveCount(0);

		await page.goto(`/plan/templates/${PUSH}`);
		await expect(page.getByRole('textbox', { name: 'Template name' })).toHaveValue('Push Day A');
		await expect(offer(page)).toHaveCount(0);
	});
});

const DAY = 86_400_000;

function workoutOf(
	id: string,
	templateId: string | null,
	startedAt: number,
	exerciseIds: string[]
): FinishedWorkout {
	return {
		id,
		templateId,
		startedAt,
		finishedAt: startedAt,
		entries: exerciseIds.map((exerciseId, at) => ({
			id: `${id}-e${at}`,
			exercises: [
				{
					id: `${id}-x${at}`,
					exerciseId,
					sets: [0, 1, 2].map((set) => ({
						id: `${id}-x${at}-s${set}`,
						type: 'normal' as const,
						plannedReps: 8,
						weight: 50,
						reps: 8,
						rpe: null,
						completed: true
					}))
				}
			]
		}))
	};
}

function templateOf(id: string, name: string, createdAt: number, exerciseIds: string[]): Template {
	return {
		id,
		name,
		createdAt,
		entries: exerciseIds.map((exerciseId, at) => ({
			id: `${id}-e${at}`,
			exercises: [
				{
					id: `${id}-x${at}`,
					exerciseId,
					sets: [0, 1, 2].map((set) => ({ id: `${id}-x${at}-s${set}`, plannedReps: 8 }))
				}
			]
		}))
	};
}

test.describe('z1 · offers on real-shaped sessions', () => {
	test('only the newest session of a plan offers, and only where it differs', async ({ page }) => {
		await openRecord(page, 'Leg Day');
		await expect(offer(page)).toBeVisible();

		await page.goto('/history');
		await page
			.getByRole('main')
			.getByRole('link', { name: /^Leg Day /u })
			.nth(1)
			.click();
		await page.waitForURL(/\/history\/[^/]+$/u);
		await expect(page.getByRole('main').getByText(/· as planned$/u)).toBeVisible();
		await expect(offer(page)).toHaveCount(0);

		for (const plan of ['Push Day', 'Pull Day']) {
			await openRecord(page, plan);
			await expect(page.getByRole('main').getByText(/· as planned$/u)).toBeVisible();
			await expect(offer(page)).toHaveCount(0);
			await expect(saveOffer(page)).toHaveCount(0);
		}

		await page.goto(`/plan/templates/${LEGS}`);
		await expect(offer(page).getByRole('heading')).toHaveText('Your last session differed');
		await page.goto(`/plan/templates/${PUSH}`);
		await expect(page.getByRole('textbox', { name: 'Template name' })).toHaveValue('Push Day');
		await expect(offer(page)).toHaveCount(0);
	});

	test('a session whose plan was deleted offers to save it as a new plan', async ({ page }) => {
		await openRecord(page, 'Bench Press + 4 more');

		const save = saveOffer(page);
		await expect(save.getByRole('heading')).toHaveText('Its plan was deleted');
		await expect(save.getByRole('button', { name: 'Save as a new plan' })).toBeVisible();
		await expect(offer(page)).toHaveCount(0);
	});

	test('a v1 session of an archived plan, and a session whose plan was edited since, offer nothing', async ({
		page,
		account,
		db
	}) => {
		const archivedAt = Date.UTC(2026, 5, 1, 10);
		const v1 = `v1-${crypto.randomUUID()}`;
		const archived = Object.assign(
			templateOf(`v1-plan-${crypto.randomUUID()}`, 'Full Body', archivedAt, [
				'squat',
				'bench-press'
			]),
			{ archivedAt }
		);

		const startedAt = Date.now() - 3 * DAY;
		const edited = templateOf(`plan-${crypto.randomUUID()}`, 'Core', startedAt - 30 * DAY, [
			'plank',
			'cable-crunch'
		]);
		const since = `since-${crypto.randomUUID()}`;

		await plantRecords(db, account.id, page, [
			{ kind: 'template', payload: archived, updatedAt: archivedAt },
			{
				kind: 'workout',
				payload: workoutOf(v1, archived.id, Date.UTC(2026, 6, 15, 16, 30), [
					'squat',
					'bench-press',
					'barbell-row'
				]),
				updatedAt: Date.UTC(2026, 7, 2)
			},
			{ kind: 'template', payload: edited, updatedAt: startedAt + 2 * 3_600_000 },
			{
				kind: 'workout',
				payload: workoutOf(since, edited.id, startedAt, [
					'plank',
					'cable-crunch',
					'hanging-leg-raise'
				]),
				updatedAt: startedAt + 3_600_000
			}
		]);

		for (const [id, plan] of [
			[v1, archived.id],
			[since, edited.id]
		]) {
			await openRecord(page, id === v1 ? 'Full Body' : 'Core');
			await expect(page).toHaveURL(new RegExp(`/history/${id}$`, 'u'));
			await expect(page.getByRole('main').getByText('Unplanned')).toBeVisible();
			await expect(offer(page)).toHaveCount(0);
			await expect(saveOffer(page)).toHaveCount(0);

			await page.goto(`/plan/templates/${plan}`);
			await expect(page.getByRole('textbox', { name: 'Template name' })).toBeVisible();
			await expect(offer(page)).toHaveCount(0);
		}
	});
});

test('z3 · an offer dismissed on one device is gone on the other after sync', async ({
	page,
	secondDevice
}) => {
	const id = await openRecord(secondDevice, 'Leg Day');
	await expect(offer(secondDevice)).toBeVisible();

	await openRecord(page, 'Leg Day');
	await offer(page).getByRole('button', { name: 'Dismiss' }).click();
	await expect(offer(page)).toBeHidden();
	await waitForSync(page);

	await syncNow(secondDevice);
	await expect
		.poll(async () => {
			const { records } = await readStore(secondDevice);

			return records.some((record) => record.id === `plan-offer:${LEGS}`);
		})
		.toBe(true);

	await secondDevice.goto(`/history/${id}`);
	await expect(secondDevice.getByRole('main').getByText('Unplanned')).toBeVisible();
	await expect(offer(secondDevice)).toHaveCount(0);

	await secondDevice.goto(`/plan/templates/${LEGS}`);
	await expect(secondDevice.getByRole('textbox', { name: 'Template name' })).toHaveValue('Leg Day');
	await expect(offer(secondDevice)).toHaveCount(0);
});
