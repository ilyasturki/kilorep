import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { RecordKind } from '../../sync/protocol.ts';

export const users = sqliteTable(
	'users',
	{
		id: text('id').notNull(),
		email: text('email').notNull().unique(),
		passwordHash: text('password_hash'),
		googleSub: text('google_sub').unique(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [primaryKey({ columns: [table.id] })]
);

export type User = typeof users.$inferSelect;

export const authTokens = sqliteTable(
	'auth_tokens',
	{
		id: text('id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		label: text('label').notNull(),
		kind: text('kind', { enum: ['web', 'device', 'api'] }).notNull(),
		tokenHash: text('token_hash').notNull().unique(),
		tokenPrefix: text('token_prefix').notNull(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
		lastUsedAt: integer('last_used_at', { mode: 'timestamp_ms' }),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' })
	},
	(table) => [primaryKey({ columns: [table.id] }), index('auth_tokens_user_idx').on(table.userId)]
);

export type AuthToken = typeof authTokens.$inferSelect;

export const googleCodes = sqliteTable(
	'google_codes',
	{
		codeHash: text('code_hash').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		challenge: text('challenge').notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [primaryKey({ columns: [table.codeHash] })]
);

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

export const records = sqliteTable(
	'records',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		id: text('id').notNull(),
		kind: text('kind').notNull().$type<RecordKind>(),
		seq: integer('seq').notNull(),
		updatedAt: integer('updated_at').notNull(),
		deletedAt: integer('deleted_at'),
		payload: text('payload', { mode: 'json' }).notNull()
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.id] }),
		index('records_user_seq_idx').on(table.userId, table.seq)
	]
);

export type RecordRow = typeof records.$inferSelect;
