import { sql } from 'drizzle-orm'
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/**
 * Catalog of exercises (e.g. "Bench Press", "Squat").
 */
export const exercises = sqliteTable('exercises', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    muscleGroup: text('muscle_group'),
    createdAt: integer('created_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
})

/**
 * A gym session.
 */
export const workouts = sqliteTable('workouts', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name'),
    notes: text('notes'),
    performedAt: integer('performed_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
})

/**
 * A single set performed for an exercise within a workout.
 */
export const sets = sqliteTable('sets', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    workoutId: integer('workout_id')
        .notNull()
        .references(() => workouts.id, { onDelete: 'cascade' }),
    exerciseId: integer('exercise_id')
        .notNull()
        .references(() => exercises.id),
    reps: integer('reps').notNull(),
    weight: real('weight'),
    position: integer('position').notNull().default(0),
})

/**
 * Bodyweight log entries (the weight tracker).
 */
export const bodyWeights = sqliteTable('body_weights', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    weight: real('weight').notNull(),
    recordedAt: integer('recorded_at', { mode: 'timestamp' })
        .notNull()
        .default(sql`(unixepoch())`),
})

export type Exercise = typeof exercises.$inferSelect
export type NewExercise = typeof exercises.$inferInsert
export type Workout = typeof workouts.$inferSelect
export type NewWorkout = typeof workouts.$inferInsert
export type WorkoutSet = typeof sets.$inferSelect
export type NewWorkoutSet = typeof sets.$inferInsert
export type BodyWeight = typeof bodyWeights.$inferSelect
export type NewBodyWeight = typeof bodyWeights.$inferInsert
