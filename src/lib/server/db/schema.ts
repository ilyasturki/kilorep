import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Server-owned tables only. Domain tables (exercises, sessions, workouts,
 * sets, body weight) are deliberately absent: they are born on a device that
 * has never seen a server, so the framework-free domain layer defines their
 * shape first and this schema mirrors it — never the other way round.
 *
 * Conventions, fixed here so every table agrees:
 *
 * - **Ids are text uuids**, never rowids. Domain records have no choice — an
 *   offline phone assigns them — so server-born rows match, and there is one
 *   id type across the whole schema. Every one is `notNull()` with the key
 *   declared table-level, and that spelling is load-bearing: SQLite enforces
 *   NOT NULL implicitly for `integer primary key` and, by a documented legacy
 *   quirk, for nothing else, so a bare `text primary key` accepts NULL — more
 *   than once. Drizzle drops `.notNull()` from the SQL when it sits on a
 *   `.primaryKey()` column, and emits it when the key is a table constraint.
 * - **Timestamps are integer epoch milliseconds.** Last-write-wins resolves
 *   conflicts by `updatedAt`, and two edits within the same second are the
 *   realistic conflict; second precision would make that a coin flip.
 */

/**
 * An account. Multi-tenancy exists from day one for a user count of one, so a
 * hosted instance is a deploy rather than a migration (STACK.md, accepted
 * costs). Every domain row will hang off `id`.
 */
export const users = sqliteTable(
	'users',
	{
		id: text('id').notNull(),
		email: text('email').notNull().unique(),
		// scrypt output, self-describing: algorithm, parameters, salt and hash in
		// one string, so the cost factor can be raised later without a migration.
		passwordHash: text('password_hash').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [primaryKey({ columns: [table.id] })]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * Every credential in the system, for every client. The web session and the
 * device/API/MCP token are one mechanism: an opaque secret, stored only as a
 * SHA-256 hash, delivered as an HttpOnly cookie to the browser and as a Bearer
 * header everywhere else. One table, one verification path, and revocation is
 * a row delete rather than a clock comparison.
 *
 * `tokenPrefix` keeps the leading characters of the cleartext so the UI can
 * match a row to the value pasted into an MCP client's config; the cleartext
 * itself is shown exactly once, at creation.
 */
export const authTokens = sqliteTable(
	'auth_tokens',
	{
		id: text('id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		// Human-facing name: "Pixel 8", "Claude Desktop".
		label: text('label').notNull(),
		kind: text('kind', { enum: ['web', 'device', 'api'] }).notNull(),
		tokenHash: text('token_hash').notNull().unique(),
		tokenPrefix: text('token_prefix').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
		lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
		// null = never expires. The APK's device token is deliberately one of
		// these: a phone that syncs twice a year must not be logged out.
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' })
	},
	(table) => [primaryKey({ columns: [table.id] }), index('auth_tokens_user_idx').on(table.userId)]
);

export type AuthToken = typeof authTokens.$inferSelect;
export type NewAuthToken = typeof authTokens.$inferInsert;

/**
 * The sync watermark source. Every write to a user's data claims the next
 * value inside the same transaction and stamps it on the row's `seq`, so a
 * pull is `where user_id = ? and seq > ?`.
 *
 * Per-user rather than global: the counter sits on the same tenant boundary as
 * every other row, and a user's watermark never jumps because of someone
 * else's activity. Ordering is by this number and never by a device clock —
 * clocks disagree, and one of them is in a gym.
 */
export const syncCounters = sqliteTable(
	'sync_counters',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		nextSeq: integer('next_seq').notNull().default(1)
	},
	(table) => [primaryKey({ columns: [table.userId] })]
);

export type SyncCounter = typeof syncCounters.$inferSelect;
