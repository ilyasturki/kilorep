import { sql } from 'drizzle-orm'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

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
