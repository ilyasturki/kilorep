import * as z from 'zod/mini'

import {
    EQUIPMENT,
    EXERCISE_TYPES,
    LOAD_MODES,
    MUSCLE_INTENSITIES,
} from '../utils/exercise'

/**
 * What makes a valid exercise, for the form and the API alike. Fields are
 * declared in the order the API has always checked them, so the first issue is
 * the message it has always returned.
 */

/**
 * A muscle row with no name is an empty slot in the form, not a mistake — the
 * editor always renders one — so blank rows are dropped before validation
 * rather than rejected. A named row with a bad intensity is still an error.
 */
function dropBlankMuscles(value: unknown): unknown[] {
    if (!Array.isArray(value)) return []
    return value.filter(
        (row) =>
            typeof row === 'object'
            && row !== null
            && 'muscle' in row
            && typeof row.muscle === 'string'
            && row.muscle.trim() !== '',
    )
}

export const muscleTargetSchema = z.object({
    muscle: z.pipe(
        z.string(),
        z.transform((muscle: string) => muscle.trim()),
    ),
    intensity: z.enum(MUSCLE_INTENSITIES, {
        error: 'Invalid muscle intensity',
    }),
})

export const exerciseInputSchema = z.object({
    name: z.pipe(
        z.transform((value: unknown) =>
            typeof value === 'string' ? value.trim() : '',
        ),
        z
            .string()
            .check(z.refine((name) => name.length > 0, 'Name is required')),
    ),
    equipment: z.enum(EQUIPMENT, { error: 'Invalid equipment' }),
    type: z.enum(EXERCISE_TYPES, { error: 'Invalid type' }),
    muscles: z.pipe(
        z.transform(dropBlankMuscles),
        z
            .array(muscleTargetSchema)
            .check(z.minLength(1, 'At least one muscle is required')),
    ),
    // Optional so pre-load-mode clients stay valid: create derives a default
    // from equipment, update keeps the stored value.
    loadMode: z.optional(z.enum(LOAD_MODES, { error: 'Invalid load mode' })),
})

export type ExerciseInput = z.output<typeof exerciseInputSchema>
