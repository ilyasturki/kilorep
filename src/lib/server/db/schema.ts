import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Relative rather than `$lib/…`: drizzle-kit loads this module with its own
// bundler, which knows nothing of SvelteKit's alias.
import type { RecordKind } from '../../sync/protocol.ts';

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
 * hosted instance is a deploy rather than a migration. Every domain row will
 * hang off `id`.
 *
 * Two ways in, and an account may hold either or both — see the two nullable
 * columns below for what each one buys.
 */
export const users = sqliteTable(
	'users',
	{
		id: text('id').notNull(),
		email: text('email').notNull().unique(),
		// scrypt output, self-describing: algorithm, parameters, salt and hash in
		// one string, so the cost factor can be raised later without a migration.
		//
		// Null for an account that has only ever signed in with Google. That null
		// is load-bearing rather than incidental: `verifyLogin` treats it exactly as
		// it treats an unknown address — a decoy verification and a refusal — so a
		// Google-only account cannot be signed into with a password, and cannot be
		// *identified* as Google-only by how fast it says no.
		passwordHash: text('password_hash'),
		// Google's `sub`: the stable, per-client subject id. Identity keys on this
		// and never on the email beside it, because an address is something a person
		// changes and a subject is not — see `resolveGoogleIdentity`, where a changed
		// address updates this row rather than finding a different one.
		//
		// Unique, and nullable so that every password-only account can hold null:
		// SQLite's unique index admits any number of them, which is the property
		// that makes one column serve both kinds of account.
		googleSub: text('google_sub').unique(),
		createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [primaryKey({ columns: [table.id] })]
);

export type User = typeof users.$inferSelect;

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

/**
 * A Google sign-in that has finished on the server but not yet reached the app
 * — the seconds between the OAuth callback and the phone claiming its token.
 *
 * It exists because the app cannot be handed the token directly. The callback
 * returns to the phone through a custom-scheme deep link, and on Android any
 * installed app may register the same scheme; whatever rides on that URL should
 * be assumed interceptable. So the URL carries a single-use code, and the token
 * is fetched over TLS by whoever can prove they started the sign-in.
 *
 * `challenge` is what makes that proof possible: the app minted a verifier
 * before opening the browser and sent only its SHA-256, so an app that steals
 * the deep link holds a code it cannot spend. Same construction as the PKCE
 * exchange with Google in `authorizationUrl`, applied to our own leg — the
 * threat is the same one, one hop closer.
 *
 * A table rather than a map in the process, for the reason the handshake cookie
 * gives for staying out of server memory: `adapter-node` is one process today,
 * and a restart mid-sign-in would fail for one person, once, in a way nobody
 * can reproduce.
 *
 * Rows are short-lived by construction — spent on claim, swept on the next
 * insert — so this never grows into a table anyone has to think about.
 */
export const googleCodes = sqliteTable(
	'google_codes',
	{
		/** SHA-256 of the cleartext, never the code itself. Same rule as `tokenHash`. */
		codeHash: text('code_hash').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		/** The app's PKCE challenge: base64url SHA-256 of a verifier only it holds. */
		challenge: text('challenge').notNull(),
		expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull()
	},
	(table) => [primaryKey({ columns: [table.codeHash] })]
);

/**
 * The sync watermark source. Every write to a user's data claims the next
 * value inside the same transaction and stamps it on the row's `seq`, so a
 * pull is `where user_id = ? and seq > ?`.
 *
 * Per-user rather than global: the counter sits on the same tenant boundary as
 * every other row, and a user's watermark never jumps because of someone
 * else's activity.
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

/**
 * Every domain record, all kinds in one table. The server's half of the sync
 * protocol treats records as opaque last-write-wins documents — it stores
 * them, orders them by `seq` and hands them back — so the honest schema is the
 * envelope plus a JSON payload, and adding a record kind costs no migration.
 * The client store is the layer that knows what a payload means; this table
 * mirrors its envelope exactly, which is the "domain layer defines the shape
 * first" promise made at the top of this file being kept.
 *
 * `updatedAt` and `deletedAt` are plain integers rather than `timestamp_ms`
 * columns on purpose: they are client-authored epoch milliseconds that must
 * round-trip byte-identical for last-write-wins to compare them, and a `Date`
 * detour is a chance to be off by something.
 *
 * The key is `(userId, id)`: ids are client-minted uuids, so scoping the key
 * per tenant means one user cannot occupy — or probe — another's id space.
 */
export const records = sqliteTable(
	'records',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		id: text('id').notNull(),
		// `$type` narrows what TypeScript reads out of the column; the endpoint's
		// `isWireRecord` guard is what keeps anything wider from being written.
		kind: text('kind').notNull().$type<RecordKind>(),
		/** Claimed from `sync_counters` in the same transaction as the write. */
		seq: integer('seq').notNull(),
		updatedAt: integer('updated_at').notNull(),
		deletedAt: integer('deleted_at'),
		payload: text('payload', { mode: 'json' }).notNull()
	},
	(table) => [
		primaryKey({ columns: [table.userId, table.id] }),
		// The pull: `where user_id = ? and seq > ?`, ordered by seq.
		index('records_user_seq_idx').on(table.userId, table.seq)
	]
);

export type RecordRow = typeof records.$inferSelect;
