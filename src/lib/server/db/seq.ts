import { eq, sql } from 'drizzle-orm';

import type { Database } from './client.ts';
import { syncCounters } from './schema.ts';

/** A `Database` or a transaction handle — both can run the claim. */
export type Executor = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Claims the next `seq` for a user and advances the counter, in one atomic
 * `update … returning`. Sync order comes from this number and never from a
 * device clock: two phones disagree about the time, and one of them is in a
 * gym with no signal.
 *
 * Call it inside the same transaction as the write it stamps — otherwise a
 * crash between the two leaves a consumed number attached to no record, and
 * the client's watermark steps over a row that was never written.
 */
export function claimSeq(executor: Executor, userId: string): number {
	const row = executor
		.update(syncCounters)
		.set({ nextSeq: sql`${syncCounters.nextSeq} + 1` })
		.where(eq(syncCounters.userId, userId))
		.returning({ nextSeq: syncCounters.nextSeq })
		.get();

	if (row === undefined) {
		throw new Error(`No sync counter for user ${userId}`);
	}

	// `returning` yields the row *after* the update, so the value just claimed
	// is one behind the counter's new position.
	return row.nextSeq - 1;
}

/** Creates a user's counter. Runs once, when the account is created. */
export function createSyncCounter(executor: Executor, userId: string): void {
	executor.insert(syncCounters).values({ userId }).run();
}
