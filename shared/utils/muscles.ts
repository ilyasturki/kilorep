import type { MuscleIntensity, MuscleTarget } from '~~/server/database/schema'

// Intensity is encoded by how filled the badge is: solid = prime mover, soft =
// secondary, down to a thin outline for muscles that only assist.
export const intensityVariant: Record<
    MuscleIntensity,
    'solid' | 'soft' | 'outline'
> = {
    high: 'solid',
    medium: 'soft',
    low: 'outline',
}

export const intensityRank: Record<MuscleIntensity, number> = {
    high: 3,
    medium: 2,
    low: 1,
}

export const sortedMuscles = (muscles: MuscleTarget[]) =>
    muscles.toSorted(
        (a, b) => intensityRank[b.intensity] - intensityRank[a.intensity],
    )

// "Most targeted" = sets × intensity weight, so a prime mover earns full
// credit per set while secondaries and assists count progressively less.
const intensityWeight: Record<MuscleIntensity, number> = {
    high: 1,
    medium: 0.5,
    low: 0.25,
}

type LoadEntry = { exercises: { exerciseId: number; sets: unknown[] }[] }

export const musclesByExercise = (
    exercises: readonly { id: number; muscles: MuscleTarget[] }[],
) => new Map(exercises.map((e) => [e.id, e.muscles]))

export function topMuscles(
    entries: LoadEntry[],
    musclesById: ReadonlyMap<number, MuscleTarget[]>,
    limit = 3,
) {
    const scores = new Map<string, number>()
    for (const entry of entries)
        for (const ex of entry.exercises)
            for (const t of musclesById.get(ex.exerciseId) ?? [])
                scores.set(
                    t.muscle,
                    (scores.get(t.muscle) ?? 0)
                        + ex.sets.length * intensityWeight[t.intensity],
                )
    return [...scores]
        .toSorted((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([muscle]) => muscle)
}

// Muscle groups collapse the 20-muscle vocabulary into the six regions the
// exercise filter offers. Flattening them in order rebuilds the form's muscle
// list (`muscleOptions`), so the two can't drift; each muscle belongs to
// exactly one group.
export const MUSCLE_GROUPS = {
    Chest: ['upper chest', 'chest', 'lower chest'],
    Shoulders: ['front delts', 'side delts', 'rear delts'],
    Back: ['lats', 'rhomboids', 'traps', 'lower back'],
    Arms: ['biceps', 'brachialis', 'forearms', 'triceps'],
    Legs: ['quads', 'hamstrings', 'glutes', 'calves'],
    Core: ['abs', 'obliques'],
} as const

export type MuscleGroup = keyof typeof MUSCLE_GROUPS
export const MUSCLE_GROUP_NAMES = Object.keys(MUSCLE_GROUPS) as MuscleGroup[]

// The muscle vocabulary the exercise form offers and the table renders.
export const muscleOptions = Object.values(MUSCLE_GROUPS).flat()

const muscleToGroup = new Map<string, MuscleGroup>(
    MUSCLE_GROUP_NAMES.flatMap((group) =>
        MUSCLE_GROUPS[group].map((muscle) => [muscle, group] as const),
    ),
)

// The set of regions an exercise touches, for the faceted muscle filter.
export const groupsOf = (exercise: {
    muscles: { muscle: string }[]
}): Set<MuscleGroup> => {
    const groups = new Set<MuscleGroup>()
    for (const m of exercise.muscles) {
        const group = muscleToGroup.get(m.muscle)
        if (group) groups.add(group)
    }
    return groups
}
