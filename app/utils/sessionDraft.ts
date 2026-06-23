import { uid } from './uid'

// The in-progress edit tree the session builder binds to. reps stays undefined
// for a set without a target — the count is then decided at workout time.
export type SessionSetDraft = { reps: number | undefined }
export type SessionExerciseDraft = {
    exerciseId: number | undefined
    sets: SessionSetDraft[]
}
// id is a client-only key for the reorder animation, never sent to the server.
export type SessionEntryDraft = {
    id: number
    exercises: SessionExerciseDraft[]
}
export type SessionDraft = { name: string; entries: SessionEntryDraft[] }

export function newSessionSet(): SessionSetDraft {
    return { reps: undefined }
}
export function newSessionExercise(): SessionExerciseDraft {
    return { exerciseId: undefined, sets: [newSessionSet()] }
}
export function newSessionEntry(exerciseCount = 1): SessionEntryDraft {
    return {
        id: uid(),
        exercises: Array.from({ length: exerciseCount }, newSessionExercise),
    }
}
export function emptySessionDraft(): SessionDraft {
    return { name: '', entries: [newSessionEntry()] }
}

// The slice of a fetched session the hydration reads — a structural subset of
// the API's SessionWithEntries, so the page passes its real data and a test
// passes a plain object.
type FetchedSession = {
    name: string
    entries: {
        exercises: { exerciseId: number; sets: { reps: number | null }[] }[]
    }[]
}

// Hydrate the builder from an existing session for editing. A null rep target
// from the API becomes undefined so the NumberFields bind cleanly.
export function sessionDraftFromSession(session: FetchedSession): SessionDraft {
    return {
        name: session.name,
        entries: session.entries.map((entry) => ({
            id: uid(),
            exercises: entry.exercises.map((se) => ({
                exerciseId: se.exerciseId,
                sets: se.sets.map((s) => ({ reps: s.reps ?? undefined })),
            })),
        })),
    }
}
