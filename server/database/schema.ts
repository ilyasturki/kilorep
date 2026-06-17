import { sql } from 'drizzle-orm'
import {
    integer,
    real,
    sqliteTable,
    text,
    uniqueIndex,
} from 'drizzle-orm/sqlite-core'

/**
 * An account. With auth configured every Google sign-in maps to one row; an
 * unconfigured (self-hosted) instance runs as a single implicit row with
 * `provider = 'local'`. All user data hangs off `userId` either way, so the
 * two modes share one code path.
 */
export const users = sqliteTable(
    'users',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        provider: text('provider').notNull(),
        // The provider's stable subject id (Google `sub`) — identity is this
        // pair, never the email, which providers let users change.
        providerAccountId: text('provider_account_id').notNull(),
        email: text('email'),
        name: text('name'),
        avatarUrl: text('avatar_url'),
        createdAt: integer('created_at', { mode: 'timestamp' })
            .notNull()
            .default(sql`(unixepoch())`),
        // How many entries of EXERCISE_CATALOG this user has been offered
        // (see plugins/seed.ts).
        catalogCursor: integer('catalog_cursor').notNull().default(0),
        // BCP-47 tag the UI formats numbers/dates with (Settings); null follows
        // the device. Validated against SUPPORTED_LOCALES (shared/locales.ts).
        locale: text('locale'),
    },
    (table) => [
        uniqueIndex('users_provider_account_unique').on(
            table.provider,
            table.providerAccountId,
        ),
    ],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

/**
 * MCP bearer tokens, several per user. Only the SHA-256 hash is stored — the
 * cleartext is shown once at creation. `tokenPrefix` keeps the first few
 * characters so the UI can match a row to the value pasted into a client's
 * config; the pre-table token migrated from `users` has only the bare 'kr_'
 * prefix because its cleartext was already gone.
 */
export const apiTokens = sqliteTable(
    'api_tokens',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        userId: integer('user_id')
            .notNull()
            .references(() => users.id),
        label: text('label').notNull(),
        tokenHash: text('token_hash').notNull(),
        tokenPrefix: text('token_prefix').notNull(),
        createdAt: integer('created_at', { mode: 'timestamp' })
            .notNull()
            .default(sql`(unixepoch())`),
        lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
    },
    (table) => [uniqueIndex('api_tokens_hash_unique').on(table.tokenHash)],
)

export type ApiToken = typeof apiTokens.$inferSelect

/** What the tokens API exposes — everything but the hash. */
export type ApiTokenInfo = Omit<ApiToken, 'tokenHash' | 'userId'>

/** How hard an exercise works a given muscle, relative to the others it hits. */
export const MUSCLE_INTENSITIES = ['high', 'medium', 'low'] as const
export type MuscleIntensity = (typeof MUSCLE_INTENSITIES)[number]

/** A single muscle worked by an exercise, with its relative intensity. */
export type MuscleTarget = {
    muscle: string
    intensity: MuscleIntensity
}

/** Primary piece of equipment an exercise is performed with. */
export const EQUIPMENT = [
    'barbell',
    'dumbbell',
    'machine',
    'cable',
    'bodyweight',
] as const
export type Equipment = (typeof EQUIPMENT)[number]

/** Whether the movement trains many muscles (compound) or one (isolation). */
export const EXERCISE_TYPES = ['compound', 'isolation'] as const
export type ExerciseType = (typeof EXERCISE_TYPES)[number]

// Where an exercise came from: `catalog` was seeded from the default catalog,
// `custom` was added by the user. Editing a catalog movement reclassifies it
// to `custom`, since it no longer matches what shipped.
export const EXERCISE_SOURCES = ['catalog', 'custom'] as const
export type ExerciseSource = (typeof EXERCISE_SOURCES)[number]

export const exercises = sqliteTable(
    'exercises',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        userId: integer('user_id')
            .notNull()
            .references(() => users.id),
        name: text('name').notNull(),
        equipment: text('equipment').$type<Equipment>().notNull(),
        type: text('type').$type<ExerciseType>().notNull(),
        // Defaults to `custom` so user-created rows are tagged without the
        // insert paths having to set it; the seeder stamps `catalog` instead.
        source: text('source')
            .$type<ExerciseSource>()
            .notNull()
            .default('custom'),
        // The muscles this exercise works, each tagged with its relative intensity.
        // Stored as JSON; a bench press and a pec fly both hit the chest, but only
        // the bench press also loads the triceps and front delts at medium effort.
        muscles: text('muscles', { mode: 'json' })
            .$type<MuscleTarget[]>()
            .notNull(),
        // Alternative names the exercise is commonly known by ("Military Press"
        // for Overhead Press); the exercise picker searches these besides `name`.
        aliases: text('aliases', { mode: 'json' })
            .$type<string[]>()
            .notNull()
            .default([]),
    },
    (table) => [
        uniqueIndex('exercises_user_name_unique').on(table.userId, table.name),
    ],
)

export type Exercise = typeof exercises.$inferSelect
export type NewExercise = typeof exercises.$inferInsert

/** A reusable workout session template, e.g. "Push Day". */
export const sessions = sqliteTable('sessions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
        .notNull()
        .references(() => users.id),
    name: text('name').notNull(),
    // Manual list order, ascending. New sessions take min(position) - 1 so
    // they land on top without rewriting sibling rows.
    position: integer('position').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
})

// A top-level block within a session, performed in `position` order. An entry
// holding one exercise is a plain exercise; an entry holding several is a
// superset, whose exercises are rotated through back-to-back. Making the entry
// the ordered unit (rather than ordering exercises and supersets separately)
// keeps a single, unambiguous sequence for the session.
export const sessionEntries = sqliteTable('session_entries', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionId: integer('session_id')
        .notNull()
        .references(() => sessions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
})

// An exercise placed inside an entry. For a superset, `position` is the
// rotation order (A, B, C → A, B, C → …).
export const sessionExercises = sqliteTable('session_exercises', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entryId: integer('entry_id')
        .notNull()
        .references(() => sessionEntries.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
        .notNull()
        .references(() => exercises.id),
    position: integer('position').notNull().default(0),
})

// A single prescribed set of a session exercise — target reps only. A template
// fixes the rep target; the load lifted is decided at workout time, not here.
// A null target means the set is planned but its reps are left open too.
export const sets = sqliteTable('sets', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionExerciseId: integer('session_exercise_id')
        .notNull()
        .references(() => sessionExercises.id, { onDelete: 'cascade' }),
    reps: integer('reps'),
    position: integer('position').notNull().default(0),
})

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type SessionEntry = typeof sessionEntries.$inferSelect
export type NewSessionEntry = typeof sessionEntries.$inferInsert
export type SessionExercise = typeof sessionExercises.$inferSelect
export type NewSessionExercise = typeof sessionExercises.$inferInsert
export type WorkoutSet = typeof sets.$inferSelect
export type NewWorkoutSet = typeof sets.$inferInsert

/** A session exercise resolved to its catalog entry and its ordered sets. */
export type SessionExerciseWithSets = SessionExercise & {
    exercise: Exercise
    sets: WorkoutSet[]
}
export type SessionEntryWithExercises = SessionEntry & {
    exercises: SessionExerciseWithSets[]
}
/** A full session tree as returned by `GET /api/sessions`. */
export type SessionWithEntries = Session & {
    entries: SessionEntryWithExercises[]
}

/**
 * An actual training session — one instance of doing a workout, started from a
 * template. Where a `session` prescribes reps and leaves the load open, a
 * `workout` records what was lifted: the reps done and the weight on the bar.
 */
export const workouts = sqliteTable('workouts', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
        .notNull()
        .references(() => users.id),
    // The template this workout was started from, kept for reference. Nulled if
    // that template is later deleted — the copied tree and `name` snapshot below
    // keep the logged history intact on their own.
    sessionId: integer('session_id').references(() => sessions.id, {
        onDelete: 'set null',
    }),
    name: text('name').notNull(),
    startedAt: integer('started_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
    completed: integer('completed', { mode: 'boolean' })
        .notNull()
        .default(false),
})

// A workout's own copy of a template entry (plain exercise or superset). The
// whole tree is copied on start so editing a workout — or later editing the
// template it came from — never rewrites logged history. Mirrors `sessionEntries`.
export const workoutEntries = sqliteTable('workout_entries', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    workoutId: integer('workout_id')
        .notNull()
        .references(() => workouts.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
})

export const workoutExercises = sqliteTable('workout_exercises', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entryId: integer('entry_id')
        .notNull()
        .references(() => workoutEntries.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
        .notNull()
        .references(() => exercises.id),
    position: integer('position').notNull().default(0),
})

// A logged set: the reps actually performed and the load lifted, in kilograms.
// `weight` stays null until entered; `done` flips as the lifter ticks the set
// off during the workout. `reps` is null while not entered — cleared mid-edit
// or seeded from an open-target template set with no history. Readers render
// it as "?" and count it as 0 in volume.
export const workoutSets = sqliteTable('workout_sets', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    workoutExerciseId: integer('workout_exercise_id')
        .notNull()
        .references(() => workoutExercises.id, { onDelete: 'cascade' }),
    reps: integer('reps'),
    weight: real('weight'),
    done: integer('done', { mode: 'boolean' }).notNull().default(false),
    position: integer('position').notNull().default(0),
})

export type Workout = typeof workouts.$inferSelect
export type NewWorkout = typeof workouts.$inferInsert
export type WorkoutEntry = typeof workoutEntries.$inferSelect
export type NewWorkoutEntry = typeof workoutEntries.$inferInsert
export type WorkoutExercise = typeof workoutExercises.$inferSelect
export type NewWorkoutExercise = typeof workoutExercises.$inferInsert
export type LoggedSet = typeof workoutSets.$inferSelect
export type NewLoggedSet = typeof workoutSets.$inferInsert

/** A workout exercise resolved to its catalog entry and its logged sets. */
export type WorkoutExerciseWithSets = WorkoutExercise & {
    exercise: Exercise
    sets: LoggedSet[]
}
export type WorkoutEntryWithExercises = WorkoutEntry & {
    exercises: WorkoutExerciseWithSets[]
}
/** A full workout tree as returned by the workouts API. */
export type WorkoutWithEntries = Workout & {
    entries: WorkoutEntryWithExercises[]
}

/**
 * One way a workout's tree differs from its template, keyed by exercise so the
 * client can render names from its catalog. `sets`/`reps` carry the workout's
 * value plus the template's (`was`) for a "now (was)" readout; `reordered` is a
 * catch-all for an order/superset-grouping change that moved no exercise in or
 * out. Rep deltas are observational — `Update` keeps the template's existing
 * prescriptions, so a rep change shown here is not what syncing back applies.
 */
export type TemplateChange =
    | { kind: 'added'; exerciseId: number }
    | { kind: 'removed'; exerciseId: number }
    | { kind: 'sets'; exerciseId: number; count: number; was: number }
    | {
          kind: 'reps'
          exerciseId: number
          setIndex: number
          reps: number | null
          was: number | null
      }
    | { kind: 'reordered' }

/**
 * A workout's link to its source template: null when no template survives
 * (deleted since), otherwise the template's identity, whether the workout's
 * structure has drifted from it, and the itemised changes for the diff view.
 * Recomputed on every workout read/write so the sync-back affordance tracks the
 * saved tree. `changes` may include rep deltas even when `diverged` is false
 * (reps alone never count as structural drift), so the strip stays gated on
 * `diverged` while the modal lists everything.
 */
export type WorkoutTemplateStatus = {
    id: number
    name: string
    diverged: boolean
    changes: TemplateChange[]
} | null

/** The payload of `GET /api/workouts/:id` — the tree plus template status. */
export type WorkoutDetail = WorkoutWithEntries & {
    template: WorkoutTemplateStatus
}

/** One logged set of an exercise, surfaced in its history view. */
export type ExerciseHistorySet = Pick<LoggedSet, 'reps' | 'weight' | 'done'>

/** A past workout that included an exercise, with the sets logged for it. */
export type ExerciseHistoryWorkout = {
    workoutId: number
    name: string
    startedAt: Workout['startedAt']
    sets: ExerciseHistorySet[]
}

/** The heaviest set ever logged for an exercise, or null if never performed. */
export type ExerciseBestSet = {
    weight: number
    reps: number
    workoutId: number
    name: string
    startedAt: Workout['startedAt']
} | null

/**
 * An exercise enriched with where it's programmed and how it's been performed —
 * the payload of `GET /api/exercises/:id`.
 */
export type ExerciseDetail = Exercise & {
    sessions: Pick<Session, 'id' | 'name'>[]
    history: ExerciseHistoryWorkout[]
    best: ExerciseBestSet
}

/** A single bodyweight weigh-in, in kilograms — one row per calendar day. */
export const bodyweight = sqliteTable(
    'bodyweight',
    {
        id: integer('id').primaryKey({ autoIncrement: true }),
        userId: integer('user_id')
            .notNull()
            .references(() => users.id),
        // The day weighed, as 'YYYY-MM-DD'. Stored as text, not a timestamp, so a
        // day stays the same day regardless of timezone, and the UNIQUE constraint
        // pins one weigh-in per user and date — re-logging a day overwrites it.
        date: text('date').notNull(),
        weight: real('weight').notNull(),
        createdAt: integer('created_at', { mode: 'timestamp' })
            .notNull()
            .default(sql`(unixepoch())`),
    },
    (table) => [
        uniqueIndex('bodyweight_user_date_unique').on(table.userId, table.date),
    ],
)

export type Bodyweight = typeof bodyweight.$inferSelect
export type NewBodyweight = typeof bodyweight.$inferInsert
