import { bodyweightId } from '../../src/lib/domain/bodyweight.ts';
import type { Database } from '../../src/lib/server/db/client.ts';
import { records } from '../../src/lib/server/db/schema.ts';
import { claimSeq } from '../../src/lib/server/db/seq.ts';

import { seedContent } from './content.ts';

export function plant(db: Database, userId: string, now: number): number {
	const { templates, workouts, bodyweight } = seedContent(now);

	return db.transaction((tx) => {
		const rows = [
			...templates.map(({ template, deletedAt }) => ({
				id: template.id,
				kind: 'template' as const,
				// `updatedAt` must move with `deletedAt`, or the delete loses last-write-wins and undeletes.
				updatedAt: deletedAt ?? template.createdAt,
				deletedAt,
				payload: template
			})),
			...workouts.map((workout) => ({
				id: workout.id,
				kind: 'workout' as const,
				updatedAt: workout.finishedAt,
				deletedAt: null,
				payload: workout
			})),
			// A day has exactly one bodyweight id, so these rows cannot carry the seed prefix:
			// they are invisible to the planted-count check, and `--force` overwrites hand-logged weights.
			...bodyweight.map(({ entry, loggedAt }) => ({
				id: bodyweightId(entry.date),
				kind: 'bodyweight' as const,
				updatedAt: loggedAt,
				deletedAt: null,
				payload: entry
			}))
		];

		for (const row of rows) {
			const values = {
				userId,
				seq: claimSeq(tx, userId),
				id: row.id,
				kind: row.kind,
				updatedAt: row.updatedAt,
				deletedAt: row.deletedAt,
				payload: row.payload
			};

			tx.insert(records)
				.values(values)
				.onConflictDoUpdate({ target: [records.userId, records.id], set: values })
				.run();
		}

		return rows.length;
	});
}
