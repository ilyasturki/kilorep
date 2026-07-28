function messageOf(value: unknown): string {
	return value instanceof Error ? value.message : '';
}

/**
 * Whether a thrown value is SQLite refusing a duplicate.
 *
 * String matching, which is unlovely, but `node:sqlite` reports constraint
 * failures in the message and offers no code to switch on. Both levels are
 * checked because drizzle replaces the message with the query text and leaves
 * SQLite's own on `cause` — the same wrapping `db.test.ts` documents.
 */
export function isUniqueViolation(thrown: unknown): boolean {
	const pattern = /unique constraint failed/iu;
	const cause = thrown instanceof Error ? thrown.cause : undefined;

	return pattern.test(messageOf(thrown)) || pattern.test(messageOf(cause));
}
