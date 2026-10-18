import type { Page } from '@playwright/test';

import type { Template } from '../src/lib/domain/template.ts';
import type { WorkoutEntry, WorkoutExercise, WorkoutSet } from '../src/lib/domain/workout.ts';
import type { Database } from '../src/lib/server/db/client.ts';
import { records } from '../src/lib/server/db/schema.ts';
import { claimSeq } from '../src/lib/server/db/seq.ts';
import type { FinishedWorkout } from '../src/lib/store/derive.ts';

import { expect } from './fixtures.ts';
import { readStore } from './helpers.ts';

export type Planted =
	| { kind: 'template'; payload: Template; updatedAt: number; deletedAt?: number }
	| { kind: 'workout'; payload: FinishedWorkout; updatedAt: number };

/**
 * Writes records into the account on the server, as another device's sync would have, and
 * relaunches `page` so its launch sync pulls them.
 */
export async function plantRecords(
	db: Database,
	userId: string,
	page: Page,
	rows: Planted[]
): Promise<void> {
	db.transaction((tx) => {
		for (const row of rows) {
			const values = {
				userId,
				seq: claimSeq(tx, userId),
				id: row.payload.id,
				kind: row.kind,
				updatedAt: row.updatedAt,
				deletedAt: row.kind === 'template' ? (row.deletedAt ?? null) : null,
				payload: row.payload
			};

			tx.insert(records).values(values).run();
		}
	});

	// Not `syncNow`: going offline mid-launch fails the launch's pull, and a failed pull with
	// nothing to push is never retried.
	await page.goto('/train');

	const ids = rows.map(({ payload }) => payload.id);

	await expect
		.poll(
			async () => {
				const { records: held } = await readStore(page);

				return ids.filter((id) => held.some((record) => record.id === id)).length;
			},
			{ timeout: 15_000 }
		)
		.toBe(ids.length);
}

export type PlantedExercise = {
	exerciseId: string;
	grip?: string;
	sets: { kg: number; reps: number; grip?: string }[];
};

const DAY = 24 * 60 * 60 * 1000;

// As stored: retired grips and folded slugs go in as written, which the app and MCP no longer produce.
export function finishedSession(daysAgo: number, exercises: PlantedExercise[]): Planted {
	const startedAt = Date.now() - daysAgo * DAY;

	const entries = exercises.map(({ exerciseId, grip, sets }): WorkoutEntry => {
		const leg: WorkoutExercise = {
			id: crypto.randomUUID(),
			exerciseId,
			sets: sets.map((planted) => {
				const set: WorkoutSet = {
					id: crypto.randomUUID(),
					type: 'normal',
					plannedReps: null,
					weight: planted.kg,
					reps: planted.reps,
					rpe: null,
					completed: true,
					entered: true
				};

				if (planted.grip !== undefined) {
					set.grip = planted.grip;
				}

				return set;
			})
		};

		if (grip !== undefined) {
			leg.grip = grip;
		}

		return { id: crypto.randomUUID(), exercises: [leg] };
	});

	const finishedAt = startedAt + 45 * 60 * 1000;

	return {
		kind: 'workout',
		payload: { id: crypto.randomUUID(), templateId: null, startedAt, finishedAt, entries },
		updatedAt: finishedAt
	};
}
