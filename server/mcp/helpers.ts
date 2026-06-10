import type {
    Exercise,
    LoggedSet,
    Session,
    Workout,
    WorkoutWithEntries,
} from '~~/server/database/schema'
import {
    and,
    asc,
    desc,
    eq,
    inArray,
    tables,
    useDrizzle,
} from '~~/server/utils/drizzle'
import { badRequest } from '~~/server/utils/http'
import { stitchWorkoutTree } from '~~/server/utils/workouts'

export type ToolResult = {
    content: { type: 'text'; text: string }[]
    isError?: boolean
}

export function text(message: string): ToolResult {
    return { content: [{ type: 'text', text: message }] }
}

// Tool bodies throw H3 errors from the shared parsers; surface their
// statusMessage (the human-readable part) as an MCP tool error instead of
// letting the SDK stringify the whole error object.
export async function run(
    fn: () => string | Promise<string>,
): Promise<ToolResult> {
    try {
        return text(await fn())
    } catch (error) {
        const message =
            (
                error
                && typeof error === 'object'
                && 'statusMessage' in error
                && typeof error.statusMessage === 'string'
                && error.statusMessage
            ) ?
                error.statusMessage
            : error instanceof Error ? error.message
            : String(error)
        return { content: [{ type: 'text', text: message }], isError: true }
    }
}

/**
 * Resolves a name typed in chat against a catalog of named rows: exact
 * case-insensitive match first, then a unique substring match. Anything else
 * errors with the closest candidates so the model can retry with a real name.
 */
function resolveByName<T extends { name: string }>(
    rows: T[],
    name: string,
    kind: string,
    hint = '',
): T {
    const query = name.trim().toLowerCase()
    const exact = rows.find((row) => row.name.toLowerCase() === query)
    if (exact) return exact

    const partial = rows.filter(
        (row) =>
            row.name.toLowerCase().includes(query)
            || query.includes(row.name.toLowerCase()),
    )
    if (partial.length === 1) return partial[0]!

    const candidates = (partial.length > 0 ? partial : rows)
        .slice(0, 8)
        .map((row) => `"${row.name}"`)
        .join(', ')
    if (partial.length > 1) {
        badRequest(`"${name}" is ambiguous — matches ${candidates}`)
    }
    badRequest(
        `No ${kind} named "${name}". Known: ${candidates || 'none'}.${hint}`,
    )
}

export function resolveExercise(userId: number, name: string): Exercise {
    const all = useDrizzle()
        .select()
        .from(tables.exercises)
        .where(eq(tables.exercises.userId, userId))
        .all()
    return resolveByName(
        all,
        name,
        'exercise',
        ' Use list_exercises to browse, or create_exercise if it is new.',
    )
}

export function resolveSessionTemplate(userId: number, name: string): Session {
    const all = useDrizzle()
        .select()
        .from(tables.sessions)
        .where(eq(tables.sessions.userId, userId))
        .all()
    return resolveByName(
        all,
        name,
        'session template',
        ' Use list_session_templates to browse.',
    )
}

/** Fetches a workout by id, or — when no id is given — the single workout
 * currently in progress, erroring when that is absent or ambiguous. */
export function resolveWorkout(userId: number, id?: number): Workout {
    const db = useDrizzle()
    if (id != null) {
        const workout = db
            .select()
            .from(tables.workouts)
            .where(
                and(
                    eq(tables.workouts.id, id),
                    eq(tables.workouts.userId, userId),
                ),
            )
            .get()
        if (!workout) badRequest(`No workout with id ${id}`)
        return workout
    }

    const active = db
        .select()
        .from(tables.workouts)
        .where(
            and(
                eq(tables.workouts.completed, false),
                eq(tables.workouts.userId, userId),
            ),
        )
        .orderBy(desc(tables.workouts.startedAt))
        .all()
    if (active.length === 1) return active[0]!
    if (active.length === 0) {
        badRequest(
            'No workout is in progress — start one with start_workout, or log a finished one with log_workout',
        )
    }
    badRequest(
        `Several workouts are in progress (${active
            .map((w) => `#${w.id} ${w.name}`)
            .join(', ')}) — pass "workout" explicitly`,
    )
}

/** Loads full workout trees for the given ids (the user's own only), newest
 * first. */
export function loadWorkoutTrees(
    userId: number,
    ids: number[],
): WorkoutWithEntries[] {
    if (ids.length === 0) return []
    const db = useDrizzle()

    const workouts = db
        .select()
        .from(tables.workouts)
        .where(
            and(
                inArray(tables.workouts.id, ids),
                eq(tables.workouts.userId, userId),
            ),
        )
        .orderBy(desc(tables.workouts.startedAt))
        .all()
    const ownedIds = workouts.map((workout) => workout.id)
    if (ownedIds.length === 0) return []
    const entries = db
        .select()
        .from(tables.workoutEntries)
        .where(inArray(tables.workoutEntries.workoutId, ownedIds))
        .orderBy(asc(tables.workoutEntries.position))
        .all()
    const entryIds = entries.map((entry) => entry.id)
    const exercises =
        entryIds.length > 0 ?
            db
                .select({
                    workoutExercise: tables.workoutExercises,
                    exercise: tables.exercises,
                })
                .from(tables.workoutExercises)
                .innerJoin(
                    tables.exercises,
                    eq(tables.workoutExercises.exerciseId, tables.exercises.id),
                )
                .where(inArray(tables.workoutExercises.entryId, entryIds))
                .orderBy(asc(tables.workoutExercises.position))
                .all()
        :   []
    const exerciseIds = exercises.map((ex) => ex.workoutExercise.id)
    const sets =
        exerciseIds.length > 0 ?
            db
                .select()
                .from(tables.workoutSets)
                .where(
                    inArray(tables.workoutSets.workoutExerciseId, exerciseIds),
                )
                .orderBy(asc(tables.workoutSets.position))
                .all()
        :   []

    return stitchWorkoutTree(workouts, entries, exercises, sets)
}

// 'en-CA' renders the server-local date as YYYY-MM-DD.
export function formatDate(date: Date): string {
    return date.toLocaleDateString('en-CA')
}

export function formatSet(
    set: Pick<LoggedSet, 'weight' | 'reps' | 'done'>,
): string {
    const load = set.weight == null ? '?' : `${set.weight}kg`
    return `${load}×${set.reps}${set.done ? '' : ' (pending)'}`
}

export function countSets(workout: WorkoutWithEntries): {
    done: number
    total: number
} {
    let done = 0
    let total = 0
    for (const entry of workout.entries) {
        for (const ex of entry.exercises) {
            total += ex.sets.length
            done += ex.sets.filter((set) => set.done).length
        }
    }
    return { done, total }
}

export function formatWorkout(workout: WorkoutWithEntries): string {
    const status = workout.completed ? 'completed' : 'in progress'
    const lines = [
        `#${workout.id} ${workout.name} — ${formatDate(workout.startedAt)} (${status})`,
    ]
    workout.entries.forEach((entry, index) => {
        const superset = entry.exercises.length > 1
        if (superset) lines.push(`${index + 1}. superset:`)
        for (const ex of entry.exercises) {
            const sets = ex.sets.map(formatSet).join(', ')
            lines.push(
                `${superset ? '   - ' : `${index + 1}. `}${ex.exercise.name}: ${sets || 'no sets'}`,
            )
        }
    })
    return lines.join('\n')
}
