import type {
    ExerciseDetail,
    ExerciseHistoryWorkout,
} from '~~/server/database/schema'

export default defineEventHandler((event): ExerciseDetail => {
    const id = getIdParam(event, 'exercise')
    const db = useDrizzle()

    const exercise = db
        .select()
        .from(tables.exercises)
        .where(eq(tables.exercises.id, id))
        .get()
    if (!exercise) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Exercise not found',
        })
    }

    // Session templates that program this exercise. A template can hold the
    // same movement in two entries, so dedupe to one chip per session.
    const sessionRows = db
        .select({ id: tables.sessions.id, name: tables.sessions.name })
        .from(tables.sessionExercises)
        .innerJoin(
            tables.sessionEntries,
            eq(tables.sessionExercises.entryId, tables.sessionEntries.id),
        )
        .innerJoin(
            tables.sessions,
            eq(tables.sessionEntries.sessionId, tables.sessions.id),
        )
        .where(eq(tables.sessionExercises.exerciseId, id))
        .orderBy(desc(tables.sessions.createdAt))
        .all()
    const seenSession = new Set<number>()
    const sessions = sessionRows.filter(
        (s) => !seenSession.has(s.id) && seenSession.add(s.id),
    )

    // Every workout that logged this exercise, with the loads lifted. Pulled in
    // two flat queries and stitched in memory, like the other read endpoints.
    const exerciseRows = db
        .select({ we: tables.workoutExercises, w: tables.workouts })
        .from(tables.workoutExercises)
        .innerJoin(
            tables.workoutEntries,
            eq(tables.workoutExercises.entryId, tables.workoutEntries.id),
        )
        .innerJoin(
            tables.workouts,
            eq(tables.workoutEntries.workoutId, tables.workouts.id),
        )
        .where(eq(tables.workoutExercises.exerciseId, id))
        .all()

    const workoutExerciseIds = exerciseRows.map((row) => row.we.id)
    const setRows =
        workoutExerciseIds.length > 0 ?
            db
                .select()
                .from(tables.workoutSets)
                .where(
                    inArray(
                        tables.workoutSets.workoutExerciseId,
                        workoutExerciseIds,
                    ),
                )
                .orderBy(asc(tables.workoutSets.position))
                .all()
        :   []
    const setsByWorkoutExercise = groupBy(
        setRows,
        (set) => set.workoutExerciseId,
    )

    // Merge sets under their workout (a workout could place the exercise in more
    // than one entry), then order workouts newest-first.
    const byWorkout = new Map<number, ExerciseHistoryWorkout>()
    for (const { we, w } of exerciseRows) {
        let entry = byWorkout.get(w.id)
        if (!entry) {
            entry = {
                workoutId: w.id,
                name: w.name,
                startedAt: w.startedAt,
                completedAt: w.completedAt,
                sets: [],
            }
            byWorkout.set(w.id, entry)
        }
        for (const set of setsByWorkoutExercise.get(we.id) ?? []) {
            entry.sets.push({
                reps: set.reps,
                weight: set.weight,
                done: set.done,
            })
        }
    }
    const history = [...byWorkout.values()].sort(
        (a, b) =>
            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    )

    // Personal best = the heaviest load lifted, tie-broken by reps at that load.
    let best: ExerciseDetail['best'] = null
    for (const workout of history) {
        for (const set of workout.sets) {
            if (set.weight == null) continue
            if (
                !best
                || set.weight > best.weight
                || (set.weight === best.weight && set.reps > best.reps)
            ) {
                best = {
                    weight: set.weight,
                    reps: set.reps,
                    workoutId: workout.workoutId,
                    name: workout.name,
                    startedAt: workout.startedAt,
                }
            }
        }
    }

    return { ...exercise, sessions, history, best }
})
