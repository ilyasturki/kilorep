import type { WorkoutWithEntries } from '~~/server/database/schema'

export default defineEventHandler((event): WorkoutWithEntries[] => {
    const userId = requireUserId(event)
    const db = useDrizzle()

    const workouts = db
        .select()
        .from(tables.workouts)
        .where(eq(tables.workouts.userId, userId))
        .orderBy(desc(tables.workouts.startedAt))
        .all()
    if (workouts.length === 0) return []

    // Same flat-read-then-stitch shape as GET /api/sessions: per-user data
    // stays small, so four flat queries beat a fanned-out join or Drizzle's
    // relational layer.
    const workoutIds = workouts.map((workout) => workout.id)
    const entries = db
        .select()
        .from(tables.workoutEntries)
        .where(inArray(tables.workoutEntries.workoutId, workoutIds))
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
    const exerciseIds = exercises.map((row) => row.workoutExercise.id)
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
})
