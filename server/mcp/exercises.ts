import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { LoadMode } from '~~/server/database/schema'
import {
    EQUIPMENT,
    EXERCISE_TYPES,
    LOAD_MODES,
    MUSCLE_INTENSITIES,
} from '~~/server/database/schema'
import { eq, tables, useDrizzle } from '~~/server/utils/drizzle'
import { createExercise, getExerciseDetail } from '~~/server/utils/exercises'
import { toDateInput } from '~~/shared/utils/date'
import { weightUnit } from '~~/shared/utils/exercise'
import { formatSet, resolveExercise, run } from './helpers'

// ", kg per hand" / ", kg one side" after a movement, silent for plain totals.
const loadModeNote = (mode: LoadMode) =>
    mode === 'total' ? '' : (
        `, kg ${mode === 'per-hand' ? 'per hand' : 'one side'}`
    )

export function registerExerciseTools(server: McpServer, userId: number) {
    server.registerTool(
        'list_exercises',
        {
            title: 'List exercises',
            description:
                'List the exercise catalog: every movement with its equipment, type and the muscles it works.',
            annotations: { readOnlyHint: true },
        },
        () =>
            run(() => {
                const exercises = useDrizzle()
                    .select()
                    .from(tables.exercises)
                    .where(eq(tables.exercises.userId, userId))
                    .all()
                if (exercises.length === 0) return 'No exercises yet.'
                return exercises
                    .map(
                        (ex) =>
                            `${ex.name} — ${ex.equipment} ${ex.type}${loadModeNote(ex.loadMode)} (${ex.muscles
                                .map((m) => `${m.muscle}: ${m.intensity}`)
                                .join(', ')})`,
                    )
                    .join('\n')
            }),
    )

    server.registerTool(
        'create_exercise',
        {
            title: 'Create exercise',
            description:
                'Add a new exercise to the catalog. Use when logging a movement that does not exist yet.',
            inputSchema: {
                name: z.string().describe('Exercise name, e.g. "Bench Press"'),
                equipment: z.enum(EQUIPMENT),
                type: z.enum(EXERCISE_TYPES),
                muscles: z
                    .array(
                        z.object({
                            muscle: z
                                .string()
                                .describe('Muscle name, e.g. "chest"'),
                            intensity: z.enum(MUSCLE_INTENSITIES),
                        }),
                    )
                    .min(1)
                    .describe('Muscles worked, with relative intensity'),
                loadMode: z
                    .enum(LOAD_MODES)
                    .optional()
                    .describe(
                        'What logged kg means: the whole load (total), one implement of a pair (per-hand), or a load moved one side at a time (unilateral). Defaults from equipment (dumbbell → per-hand).',
                    ),
            },
            annotations: { destructiveHint: false },
        },
        (input) =>
            run(() => {
                const exercise = createExercise(userId, input)
                return `Created exercise "${exercise.name}" (${exercise.equipment} ${exercise.type})`
            }),
    )

    server.registerTool(
        'get_exercise_progress',
        {
            title: 'Exercise progress',
            description:
                'Progress for one exercise: personal best, the templates that program it, and recent workout history with the loads lifted.',
            inputSchema: {
                exercise: z.string().describe('Exercise name (fuzzy-matched)'),
                limit: z
                    .number()
                    .int()
                    .positive()
                    .optional()
                    .describe(
                        'How many recent workouts to include (default 10)',
                    ),
            },
            annotations: { readOnlyHint: true },
        },
        (input) =>
            run(() => {
                const exercise = resolveExercise(userId, input.exercise)
                const detail = getExerciseDetail(exercise.id, userId)
                const limit = input.limit ?? 10

                const lines = [
                    `${detail.name} — ${detail.equipment} ${detail.type}${loadModeNote(detail.loadMode)}`,
                ]
                lines.push(
                    detail.best ?
                        `Best: ${detail.best.weight}${weightUnit(detail.loadMode)}×${detail.best.reps} (${toDateInput(detail.best.startedAt)}, ${detail.best.name} #${detail.best.workoutId})`
                    :   'Best: none logged yet',
                )
                if (detail.sessions.length > 0) {
                    lines.push(
                        `Programmed in: ${detail.sessions.map((s) => s.name).join(', ')}`,
                    )
                }
                if (detail.history.length === 0) {
                    lines.push('Never performed in a workout.')
                } else {
                    lines.push(
                        `History (last ${Math.min(limit, detail.history.length)} of ${detail.history.length} workouts):`,
                    )
                    for (const workout of detail.history.slice(0, limit)) {
                        const sets = workout.sets.map(formatSet).join(', ')
                        lines.push(
                            `  ${toDateInput(workout.startedAt)} ${workout.name} #${workout.workoutId}: ${sets || 'no sets'}`,
                        )
                    }
                }
                return lines.join('\n')
            }),
    )
}
