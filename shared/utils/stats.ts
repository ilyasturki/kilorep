import type { LoadMode } from './exercise'
import { loadFactor } from './exercise'

// Volume is load × reps × load-factor summed over sets, with un-entered
// weights and reps counted as 0 — a cleared NumberField leaves undefined in
// the draft. The factor doubles per-hand and unilateral loads (see LOAD_MODES)
// so tonnage counts what actually moved, while entered weights stay raw.
// Shared by the workout list/detail pages, the dashboard, and the server so the
// definition stays single across app and API.
type StatSet = { reps?: number | null; weight?: number | null }
// The exercise's mode rides either flat on a draft or nested under the API
// tree's `exercise`, so both shapes pass through unchanged.
type StatExercise = {
    sets: StatSet[]
    loadMode?: LoadMode | null
    exercise?: { loadMode?: LoadMode | null }
}
type StatEntry = { exercises: StatExercise[] }

const modeOf = (ex: StatExercise) => ex.loadMode ?? ex.exercise?.loadMode

const rawVolume = (sets: StatSet[], factor = 1) =>
    sets.reduce((v, s) => v + (s.weight ?? 0) * (s.reps ?? 0) * factor, 0)

export const setVolume = (sets: StatSet[], mode?: LoadMode | null) =>
    Math.round(rawVolume(sets, loadFactor(mode)))

export function workoutStats(entries: StatEntry[]) {
    let exercises = 0
    let sets = 0
    let volume = 0
    for (const entry of entries) {
        for (const ex of entry.exercises) {
            exercises++
            sets += ex.sets.length
            volume += rawVolume(ex.sets, loadFactor(modeOf(ex)))
        }
    }
    return { exercises, sets, volume: Math.round(volume) }
}

// Epley estimated 1RM: weight × (1 + reps/30). A single rep returns the weight
// itself, so a 1-rep set never reads as a higher "estimate" than it was.
export const epley1rm = (weight: number, reps: number) =>
    weight * (1 + reps / 30)
