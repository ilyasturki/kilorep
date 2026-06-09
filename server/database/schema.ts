import { sql } from 'drizzle-orm'
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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

export const exercises = sqliteTable('exercises', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    equipment: text('equipment').$type<Equipment>().notNull(),
    type: text('type').$type<ExerciseType>().notNull(),
    // The muscles this exercise works, each tagged with its relative intensity.
    // Stored as JSON; a bench press and a pec fly both hit the chest, but only
    // the bench press also loads the triceps and front delts at medium effort.
    muscles: text('muscles', { mode: 'json' })
        .$type<MuscleTarget[]>()
        .notNull(),
})

export type Exercise = typeof exercises.$inferSelect
export type NewExercise = typeof exercises.$inferInsert

/** A reusable workout session template, e.g. "Push Day". */
export const sessions = sqliteTable('sessions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
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
export const sets = sqliteTable('sets', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    sessionExerciseId: integer('session_exercise_id')
        .notNull()
        .references(() => sessionExercises.id, { onDelete: 'cascade' }),
    reps: integer('reps').notNull(),
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
    // Null while the workout is in progress; stamped when the lifter finishes.
    completedAt: integer('completed_at', { mode: 'timestamp' }),
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
// off during the workout.
export const workoutSets = sqliteTable('workout_sets', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    workoutExerciseId: integer('workout_exercise_id')
        .notNull()
        .references(() => workoutExercises.id, { onDelete: 'cascade' }),
    reps: integer('reps').notNull(),
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

/** One logged set of an exercise, surfaced in its history view. */
export type ExerciseHistorySet = Pick<LoggedSet, 'reps' | 'weight' | 'done'>

/** A past workout that included an exercise, with the sets logged for it. */
export type ExerciseHistoryWorkout = {
    workoutId: number
    name: string
    startedAt: Workout['startedAt']
    completedAt: Workout['completedAt']
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
export const bodyweight = sqliteTable('bodyweight', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    // The day weighed, as 'YYYY-MM-DD'. Stored as text, not a timestamp, so a
    // day stays the same day regardless of timezone, and the UNIQUE constraint
    // pins one weigh-in per date — re-logging a day overwrites its value.
    date: text('date').notNull().unique(),
    weight: real('weight').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
})

export type Bodyweight = typeof bodyweight.$inferSelect
export type NewBodyweight = typeof bodyweight.$inferInsert
