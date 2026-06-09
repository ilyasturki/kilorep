// Volume is load × reps summed over sets, with un-entered weights counted as 0.
// Shared by the workout list and detail pages so the definition stays single.
type StatSet = { reps: number; weight?: number | null }
type StatEntry = { exercises: { sets: StatSet[] }[] }

const rawVolume = (sets: StatSet[]) =>
    sets.reduce((v, s) => v + (s.weight ?? 0) * s.reps, 0)

export const setVolume = (sets: StatSet[]) => Math.round(rawVolume(sets))

export function workoutStats(entries: StatEntry[]) {
    let exercises = 0
    let sets = 0
    let volume = 0
    for (const entry of entries) {
        for (const ex of entry.exercises) {
            exercises++
            sets += ex.sets.length
            volume += rawVolume(ex.sets)
        }
    }
    return { exercises, sets, volume: Math.round(volume) }
}
