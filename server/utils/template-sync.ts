import type { WorkoutTemplateStatus } from '~~/server/database/schema'
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

/**
 * Resolves a workout's template link for the API: null when the template is
 * gone, otherwise its identity plus the structural diff. There is no
 * copy-time snapshot of the template, so the comparison is always against its
 * current state — a template edited mid-workout reads as divergence too,
 * which is the honest answer either way.
 */
export function workoutTemplateStatus(
    userId: number,
    sessionId: number | null,
    entries: StructureEntry[],
): WorkoutTemplateStatus {
    if (sessionId == null) return null
    const session = loadSessionTrees(userId, [sessionId])[0]
    if (!session) return null
    return {
        id: session.id,
        name: session.name,
        diverged: structuresDiffer(entries, session.entries),
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
