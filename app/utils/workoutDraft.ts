import { uid } from './uid'

// The in-progress edit tree the workout editor binds to. reps/weight are
// undefined while their NumberField is cleared mid-edit, and reps also when the
// set came from an open-target template set. repHint is the last logged reps
// snapshotted at workout start for open-target sets — shown as the empty reps
// field's placeholder, never written to reps.
export type WorkoutSetDraft = {
    reps: number | undefined
    weight: number | undefined
    repHint?: number
}
export type WorkoutExerciseDraft = {
    exerciseId: number
    name: string
    sets: WorkoutSetDraft[]
}
// id is a client-only key for the reorder animation, never sent to the server.
export type WorkoutEntryDraft = {
    id: number
    exercises: WorkoutExerciseDraft[]
}

export function newWorkoutSet(): WorkoutSetDraft {
    return { reps: undefined, weight: undefined }
}

export function newWorkoutExercise(exercise: {
    id: number
    name: string
}): WorkoutExerciseDraft {
    return {
        exerciseId: exercise.id,
        name: exercise.name,
        sets: [newWorkoutSet()],
    }
}

// The slice of a fetched workout tree the hydration reads — a structural subset
// of the API's WorkoutDetail entries, so the page passes its real data and a
// test passes a plain object.
type FetchedWorkoutEntry = {
    exercises: {
        exerciseId: number
        exercise: { name: string }
        sets: {
            reps: number | null
            weight: number | null
            repHint?: number | null
        }[]
    }[]
}

// Hydrate the editor draft from a fetched workout tree. A null reps/weight from
// the API becomes undefined so the NumberFields bind cleanly.
export function workoutDraftFromEntries(
    entries: FetchedWorkoutEntry[],
): WorkoutEntryDraft[] {
    return entries.map((entry) => ({
        id: uid(),
        exercises: entry.exercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            name: ex.exercise.name,
            sets: ex.sets.map((s) => ({
                reps: s.reps ?? undefined,
                weight: s.weight ?? undefined,
                repHint: s.repHint ?? undefined,
            })),
        })),
    }))
}

// "Add set" starts blank: an extra effort is a decision, not a repeat of the
// previous line, and a pre-filled row reads as already logged.
export function addWorkoutSet(exercise: WorkoutExerciseDraft): void {
    exercise.sets.push(newWorkoutSet())
}

export function removeWorkoutSet(
    exercise: WorkoutExerciseDraft,
    index: number,
): void {
    exercise.sets.splice(index, 1)
}

// Remove an exercise, dropping the entry when it leaves it empty.
export function removeWorkoutExercise(
    entries: WorkoutEntryDraft[],
    entryIndex: number,
    exIndex: number,
): void {
    const entry = entries[entryIndex]
    if (!entry) return
    entry.exercises.splice(exIndex, 1)
    if (entry.exercises.length === 0) entries.splice(entryIndex, 1)
}

// Split a superset entry back into one entry per exercise, reusing the exercise
// objects so logged sets survive.
export function ungroupWorkoutEntry(
    entries: WorkoutEntryDraft[],
    entryIndex: number,
): void {
    const entry = entries[entryIndex]
    if (!entry || entry.exercises.length < 2) return
    entries.splice(
        entryIndex,
        1,
        ...entry.exercises.map((ex) => ({ id: uid(), exercises: [ex] })),
    )
}

// Serialize the draft to the PUT /api/workouts/:id body: undefined weight rides
// as null, reps pass through as-is. repHint is echoed back so the snapshot
// survives the server's whole-tree rewrite.
export function workoutDraftToBody(
    entries: WorkoutEntryDraft[],
    opts: { completed: boolean; startedAt: string | undefined },
) {
    return {
        completed: opts.completed,
        startedAt: opts.startedAt,
        entries: entries.map((entry) => ({
            exercises: entry.exercises.map((ex) => ({
                exerciseId: ex.exerciseId,
                sets: ex.sets.map((s) => ({
                    reps: s.reps,
                    weight: s.weight ?? null,
                    repHint: s.repHint ?? null,
                })),
            })),
        })),
    }
}
