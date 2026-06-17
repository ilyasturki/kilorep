import type {
    TemplateChange,
    WorkoutTemplateStatus,
} from '~~/server/database/schema'
import type { ParsedSession } from '~~/server/utils/sessions'

// The structural skeleton both trees share: entry grouping/order, the
// exercises in each entry, and per-exercise set counts. Session and workout
// trees (and a parsed PUT payload) all satisfy this shape.
type StructureEntry = {
    exercises: { exerciseId: number; sets: { reps: number | null }[] }[]
}

/**
 * Whether two trees differ structurally — entries, exercise membership/order,
 * or set counts. Rep values are deliberately ignored: editing logged reps is
 * performance data, not a change of plan, and comparing them would light the
 * sync-back offer after nearly every workout.
 */
export function structuresDiffer(
    a: StructureEntry[],
    b: StructureEntry[],
): boolean {
    if (a.length !== b.length) return true
    return a.some((entryA, i) => {
        const entryB = b[i]
        if (!entryB || entryA.exercises.length !== entryB.exercises.length) {
            return true
        }
        return entryA.exercises.some((exA, j) => {
            const exB = entryB.exercises[j]
            return (
                !exB
                || exA.exerciseId !== exB.exerciseId
                || exA.sets.length !== exB.sets.length
            )
        })
    })
}

type StructureExercise = StructureEntry['exercises'][number]

const flattenExercises = (entries: StructureEntry[]): StructureExercise[] =>
    entries.flatMap((entry) => entry.exercises)

/**
 * Itemises how a workout's tree differs from its template, for the diff view.
 * Exercises are matched by id, FIFO, exactly as `workoutToSessionEntries`
 * claims them, so added/removed/kept mirror what an Update reconciles. Kept
 * exercises also report set-count and per-set rep-target deltas. A pure reorder
 * or superset regrouping moves nothing in or out, so it surfaces as a single
 * `reordered` note rather than a wall of phantom add/remove pairs.
 */
export function diffWorkoutFromTemplate(
    workout: StructureEntry[],
    template: StructureEntry[],
): TemplateChange[] {
    const changes: TemplateChange[] = []

    const unclaimed = new Map<number, StructureExercise[]>()
    for (const ex of flattenExercises(template)) {
        const queue = unclaimed.get(ex.exerciseId) ?? []
        queue.push(ex)
        unclaimed.set(ex.exerciseId, queue)
    }

    let structural = false
    for (const ex of flattenExercises(workout)) {
        const prescribed = unclaimed.get(ex.exerciseId)?.shift()
        if (!prescribed) {
            changes.push({ kind: 'added', exerciseId: ex.exerciseId })
            structural = true
            continue
        }
        if (ex.sets.length !== prescribed.sets.length) {
            changes.push({
                kind: 'sets',
                exerciseId: ex.exerciseId,
                count: ex.sets.length,
                was: prescribed.sets.length,
            })
            structural = true
        }
        const overlap = Math.min(ex.sets.length, prescribed.sets.length)
        for (let i = 0; i < overlap; i++) {
            const reps = ex.sets[i]!.reps
            const was = prescribed.sets[i]!.reps
            if (reps !== was) {
                changes.push({
                    kind: 'reps',
                    exerciseId: ex.exerciseId,
                    setIndex: i,
                    reps,
                    was,
                })
            }
        }
    }

    for (const queue of unclaimed.values()) {
        for (const ex of queue) {
            changes.push({ kind: 'removed', exerciseId: ex.exerciseId })
            structural = true
        }
    }

    if (!structural && structuresDiffer(workout, template)) {
        changes.push({ kind: 'reordered' })
    }

    return changes
}

/**
 * Resolves a workout's template link for the API: null when the template is
 * gone, otherwise its identity plus the itemised diff. There is no copy-time
 * snapshot of the template, so the comparison is always against its current
 * state — a template edited mid-workout reads as divergence too, which is the
 * honest answer either way. `diverged` (which gates the strip) is true iff a
 * structural change exists: every change kind but `reps` is structural, so a
 * rep-only delta leaves the list non-empty while the strip stays hidden.
 */
export function workoutTemplateStatus(
    userId: number,
    sessionId: number | null,
    entries: StructureEntry[],
): WorkoutTemplateStatus {
    if (sessionId == null) return null
    const session = loadSessionTrees(userId, [sessionId])[0]
    if (!session) return null
    const changes = diffWorkoutFromTemplate(entries, session.entries)
    return {
        id: session.id,
        name: session.name,
        diverged: changes.some((change) => change.kind !== 'reps'),
        changes,
    }
}

/**
 * Maps a workout's tree to template entries, syncing structure while keeping
 * the template's prescriptions: each workout exercise claims the template's
 * next unclaimed occurrence of the same exercise and keeps its prescribed
 * reps position by position — a deliberately open target (null reps) stays
 * open. Only genuinely new sets and exercises take their reps from what was
 * logged — a failed set never silently becomes the new prescription.
 */
export function workoutToSessionEntries(
    workoutEntries: StructureEntry[],
    templateEntries: StructureEntry[] = [],
): ParsedSession['entries'] {
    const unclaimed = new Map<number, { reps: number | null }[][]>()
    for (const entry of templateEntries) {
        for (const ex of entry.exercises) {
            const queue = unclaimed.get(ex.exerciseId) ?? []
            queue.push(ex.sets)
            unclaimed.set(ex.exerciseId, queue)
        }
    }

    return workoutEntries.map((entry) => ({
        exercises: entry.exercises.map((ex) => {
            const prescribed = unclaimed.get(ex.exerciseId)?.shift() ?? []
            return {
                exerciseId: ex.exerciseId,
                sets: ex.sets.map((set, i) => ({
                    reps:
                        i < prescribed.length ? prescribed[i]!.reps : set.reps,
                })),
            }
        }),
    }))
}
