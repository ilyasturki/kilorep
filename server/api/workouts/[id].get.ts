import type { WorkoutWithEntries } from '~~/server/database/schema'

export default defineEventHandler((event): WorkoutWithEntries => {
    const userId = requireUserId(event)
    const id = getIdParam(event, 'workout')
    const db = useDrizzle()

    const workout = db
        .select()
        .from(tables.workouts)
        .where(
            and(eq(tables.workouts.id, id), eq(tables.workouts.userId, userId)),
        )
        .get()
    if (!workout) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Workout not found',
        })
    }

    const entries = db
        .select()
        .from(tables.workoutEntries)
        .where(eq(tables.workoutEntries.workoutId, id))
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

    return stitchWorkoutTree([workout], entries, exercises, sets)[0]!
})
