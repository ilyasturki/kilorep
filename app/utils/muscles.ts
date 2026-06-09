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
