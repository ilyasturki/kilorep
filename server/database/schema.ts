import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

/** How hard an exercise works a given muscle, relative to the others it hits. */
export type MuscleIntensity = 'high' | 'medium' | 'low'

/** A single muscle worked by an exercise, with its relative intensity. */
export type MuscleTarget = {
    muscle: string
    intensity: MuscleIntensity
}

/** Primary piece of equipment an exercise is performed with. */
export type Equipment =
    | 'barbell'
    | 'dumbbell'
    | 'machine'
    | 'cable'
    | 'bodyweight'

/** Whether the movement trains many muscles (compound) or one (isolation). */
export type ExerciseType = 'compound' | 'isolation'

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
