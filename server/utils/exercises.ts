import type { Equipment, ExerciseType, MuscleTarget } from '../database/schema'
import {
    EQUIPMENT,
    EXERCISE_TYPES,
    MUSCLE_INTENSITIES,
} from '../database/schema'

function isOneOf<T extends string>(
    values: readonly T[],
    value: unknown,
): value is T {
    return (
        typeof value === 'string'
        && (values as readonly string[]).includes(value)
    )
}

export type ExerciseInput = {
    name: string
    equipment: Equipment
    type: ExerciseType
    muscles: MuscleTarget[]
}

// Validates a raw exercise payload, throwing a 400 on any malformed field.
// Shared by the create and update handlers so both enforce the same shape.
export function parseExerciseInput(
    body: Record<string, unknown>,
): ExerciseInput {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Name is required',
        })
    }

    const { equipment, type } = body
    if (!isOneOf(EQUIPMENT, equipment)) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Invalid equipment',
        })
    }
    if (!isOneOf(EXERCISE_TYPES, type)) {
        throw createError({ statusCode: 400, statusMessage: 'Invalid type' })
    }

    const muscles: MuscleTarget[] = []
    for (const target of Array.isArray(body.muscles) ? body.muscles : []) {
        const muscle =
            typeof target?.muscle === 'string' ? target.muscle.trim() : ''
        if (!muscle) continue
        if (!isOneOf(MUSCLE_INTENSITIES, target.intensity)) {
            throw createError({
                statusCode: 400,
                statusMessage: 'Invalid muscle intensity',
            })
        }
        muscles.push({ muscle, intensity: target.intensity })
    }
    if (muscles.length === 0) {
        throw createError({
            statusCode: 400,
            statusMessage: 'At least one muscle is required',
        })
    }

    return { name, equipment, type, muscles }
}

// Maps SQLite's UNIQUE-violation error to a friendly 409 on the name column.
export function asDuplicateNameError(error: unknown): never {
    if (error instanceof Error && error.message.includes('UNIQUE')) {
        throw createError({
            statusCode: 409,
            statusMessage: 'An exercise with that name already exists',
        })
    }
    throw error
}
