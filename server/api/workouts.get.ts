import type { WorkoutWithEntries } from '~~/server/database/schema'

export default defineEventHandler((): WorkoutWithEntries[] => {
    const db = useDrizzle()

    const workouts = db
        .select()
        .from(tables.workouts)
        .orderBy(desc(tables.workouts.startedAt))
        .all()
    if (workouts.length === 0) return []

    // Same flat-read-then-stitch shape as GET /api/sessions: single-user data
    // stays small, so four flat queries beat a fanned-out join or Drizzle's
    // relational layer.
    const entries = db
        .select()
        .from(tables.workoutEntries)
        .orderBy(asc(tables.workoutEntries.position))
        .all()
    const exercises = db
        .select({
            workoutExercise: tables.workoutExercises,
            exercise: tables.exercises,
        })
        .from(tables.workoutExercises)
        .innerJoin(
            tables.exercises,
            eq(tables.workoutExercises.exerciseId, tables.exercises.id),
        )
        .orderBy(asc(tables.workoutExercises.position))
        .all()
    const sets = db
        .select()
        .from(tables.workoutSets)
        .orderBy(asc(tables.workoutSets.position))
        .all()

    return stitchWorkoutTree(workouts, entries, exercises, sets)
})
