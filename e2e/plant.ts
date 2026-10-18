import type { Page } from '@playwright/test';

import type { Template } from '../src/lib/domain/template.ts';
import type { Database } from '../src/lib/server/db/client.ts';
import { records } from '../src/lib/server/db/schema.ts';
import { claimSeq } from '../src/lib/server/db/seq.ts';
import type { FinishedWorkout } from '../src/lib/store/derive.ts';

import { expect } from './fixtures.ts';
import { readStore, syncNow } from './helpers.ts';

export type Planted =
	| { kind: 'template'; payload: Template; updatedAt: number; deletedAt?: number }
	| { kind: 'workout'; payload: FinishedWorkout; updatedAt: number };

/**
 * Writes records into the account on the server, as another device's sync would have, and
 * pulls them onto `page`'s device.
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

	await page.goto('/train');
	await syncNow(page);

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
