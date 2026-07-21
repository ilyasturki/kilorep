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

/**
 * What the kilograms entered for a set mean: the whole load (`total` — full
 * stack, bar included), what ONE implement of a pair reads (`per-hand` — two
 * dumbbells or two cable stacks), or a load moved by one side at a time
 * (`unilateral` — a logged set covers both sides, reps counted per side).
 */
export const LOAD_MODES = ['total', 'per-hand', 'unilateral'] as const
export type LoadMode = (typeof LOAD_MODES)[number]

/** Form labels for the load-mode picker, in LOAD_MODES order. */
export const LOAD_MODE_LABELS: Record<LoadMode, string> = {
    total: 'total',
    'per-hand': 'per hand',
    unilateral: 'one side',
}

/**
 * How many kilograms actually move per rep for each entered kilogram: both
 * hands hold one each (per-hand), or both sides get their own turn at the
 * load (unilateral).
 */
export const loadFactor = (mode: LoadMode | null | undefined): number =>
    mode === 'per-hand' || mode === 'unilateral' ? 2 : 1

/** The display unit that follows a weight of the given mode. */
export const weightUnit = (mode: LoadMode | null | undefined): string =>
    mode === 'per-hand' ? 'kg/hand'
    : mode === 'unilateral' ? 'kg/side'
    : 'kg'

/** The default mode a new exercise gets when none is chosen. */
export const defaultLoadMode = (equipment: Equipment): LoadMode =>
    equipment === 'dumbbell' ? 'per-hand' : 'total'

// Where an exercise came from: `catalog` was seeded from the default catalog,
// `custom` was added by the user. Editing a catalog movement reclassifies it
// to `custom`, since it no longer matches what shipped.
export const EXERCISE_SOURCES = ['catalog', 'custom'] as const
export type ExerciseSource = (typeof EXERCISE_SOURCES)[number]
