import type { WorkoutWithEntries } from '~~/server/database/schema'

export default defineEventHandler((event): WorkoutWithEntries[] => {
    const userId = requireUserId(event)

    const ids = useDrizzle()
        .select({ id: tables.workouts.id })
        .from(tables.workouts)
        .where(eq(tables.workouts.userId, userId))
        .all()
        .map((row) => row.id)
    return loadWorkoutTrees(userId, ids)
})
