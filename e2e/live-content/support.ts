import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import type { Database } from '../../src/lib/server/db/client.ts';
import { records } from '../../src/lib/server/db/schema.ts';
import { claimSeq } from '../../src/lib/server/db/seq.ts';
import type { WorkoutExercise, WorkoutSet } from '../../src/lib/domain/workout.ts';
import type { FinishedWorkout } from '../../src/lib/store/derive.ts';

import { readStore, syncNow } from '../helpers.ts';

/** Writes finished workouts on the server and resolves once the page's device holds them. */
export async function plantWorkouts(
	page: Page,
	db: Database,
	userId: string,
	workouts: FinishedWorkout[]
): Promise<void> {
	db.transaction((tx) => {
		for (const workout of workouts) {
			tx.insert(records)
				.values({
					userId,
					seq: claimSeq(tx, userId),
					id: workout.id,
					kind: 'workout',
					updatedAt: workout.finishedAt,
					deletedAt: null,
					payload: workout
				})
				.run();
		}
	});

	await syncNow(page);

	const ids = workouts.map(({ id }) => id);

	await expect
		.poll(
			async () => {
				const store = await readStore(page);
				const held = new Set(store.records.map(({ id }) => id));

				return ids.every((id) => held.has(id));
			},
			{ message: 'planted workouts still missing from the device', timeout: 15_000 }
		)
		.toBe(true);
}

type PlantedSet = { weight: number; reps: number; grip?: string };

type PlantedExercise = { exerciseId: string; grip?: string; sets: PlantedSet[] };

function loggedSet(id: string, { weight, reps, grip }: PlantedSet): WorkoutSet {
	const set: WorkoutSet = {
		id,
		type: 'normal',
		plannedReps: null,
		weight,
		reps,
		rpe: null,
		completed: true
	};

	if (grip !== undefined) {
		set.grip = grip;
	}

	return set;
}

/** Logged sets, one entry per exercise. */
export function pastWorkout(
	id: string,
	minutesAgo: number,
	exercises: PlantedExercise[]
): FinishedWorkout {
	const startedAt = Date.now() - minutesAgo * 60_000;

	return {
		id,
		templateId: null,
		startedAt,
		finishedAt: startedAt + 45 * 60_000,
		entries: exercises.map((exercise, at) => {
			const node: WorkoutExercise = {
				id: `${id}-x${at}`,
				exerciseId: exercise.exerciseId,
				sets: exercise.sets.map((set, index) => loggedSet(`${id}-x${at}-s${index}`, set))
			};

			if (exercise.grip !== undefined) {
				node.grip = exercise.grip;
			}

			return { id: `${id}-e${at}`, exercises: [node] };
		})
	};
}

export function onDesk(page: Page): boolean {
	const viewport = page.viewportSize();

	return viewport !== null && viewport.width >= 1024;
}

/** The phone's section of an exercise, or its block of the desk ledger. */
export function exerciseBlock(page: Page, name: string): Locator {
	const options = page.getByRole('button', { name: `${name} options`, exact: true });

	return page.getByRole('main').locator('section, [data-drag-id]', { has: options });
}

/** A set's row, by the label its mark reads: `set 2 pending`, `warmup set`, `set A1 logged`. */
export function setRow(block: Locator, mark: string | RegExp): Locator {
	const exact = typeof mark === 'string';

	// A ledger row is a clickable grid with no role; its mark sits in the first cell.
	return onDesk(block.page())
		? block.getByRole('img', { name: mark, exact }).locator('xpath=../..')
		: block
				.getByRole('button')
				.filter({ has: block.page().getByRole('img', { name: mark, exact }) });
}

export function tray(page: Page): Locator {
	return page.getByRole('button', { name: /^(?:Lower|Raise) the set editor$/u }).locator('..');
}

/** What the tray's Last label reads: the hint, or First time. */
export function trayLast(page: Page): Locator {
	return tray(page).getByText('Last', { exact: true }).locator('xpath=following-sibling::span');
}

export function menuItem(page: Page, name: string): Locator {
	return page
		.getByRole('menuitem', { name, exact: true })
		.or(page.getByRole('dialog').getByRole('button', { name, exact: true }));
}

export async function exerciseAction(page: Page, name: string, action: string): Promise<void> {
	await page.getByRole('button', { name: `${name} options`, exact: true }).click();
	await menuItem(page, action).click();
}

/** Holds a press until what the hold opens is on screen. */
export async function longPress(page: Page, target: Locator, opens: Locator): Promise<void> {
	const box = await target.boundingBox();

	if (box === null) {
		throw new Error('nothing to press');
	}

	await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
	await page.mouse.down();
	await expect(opens).toBeVisible();
	await page.mouse.up();
}

/** A thumb dragged sideways across a row, rightward for a positive `dx`. */
export async function swipe(page: Page, target: Locator, dx: number): Promise<void> {
	const box = await target.boundingBox();

	if (box === null) {
		throw new Error('nothing to swipe');
	}

	const y = box.y + box.height / 2;
	const x = dx > 0 ? box.x + 24 : box.x + box.width - 24;

	await page.mouse.move(x, y);
	await page.mouse.down();
	await page.mouse.move(x + dx, y, { steps: 12 });
	await page.mouse.up();
}
