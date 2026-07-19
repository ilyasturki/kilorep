/**
 * The exercise vocabulary: the closed sets a movement is described with. Lives
 * in shared/ rather than beside the drizzle tables because the form, the filter
 * bar and the validators all need the values, and importing them from
 * server/database/schema drags drizzle-orm — and every table and column name —
 * into the browser bundle.
 */

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
