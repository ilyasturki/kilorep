export default defineEventHandler(async (event) => {
    const id = getIdParam(event, 'workout')
    const parsed = parseWorkoutInput(await readBody<WorkoutInput>(event))

    return useDrizzle().transaction((tx) => {
        const existing = tx
            .select()
            .from(tables.workouts)
            .where(eq(tables.workouts.id, id))
            .get()
        if (!existing) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Workout not found',
            })
        }

        // Moving the date shifts the whole workout by the same delta, so its
        // duration (completedAt − startedAt) is preserved.
        const startedAt = parsed.startedAt ?? existing.startedAt
        const delta = startedAt.getTime() - existing.startedAt.getTime()
        const shiftedCompletedAt =
            existing.completedAt ?
                new Date(existing.completedAt.getTime() + delta)
            :   null

        // Stamp completion on the first finish; reopening clears it. Saving an
        // already-finished workout keeps its (shifted) timestamp.
        const completedAt =
            parsed.completed ? (shiftedCompletedAt ?? new Date()) : null

        const updated = tx
            .update(tables.workouts)
            .set({
                ...(parsed.name ? { name: parsed.name } : {}),
                startedAt,
                completedAt,
            })
            .where(eq(tables.workouts.id, id))
            .returning()
            .get()

        // Replace the whole tree rather than diffing: the simplest correct way
        // to persist arbitrary add/remove/reorder edits. Deleting the entries
        // cascades to their exercises and sets.
        tx.delete(tables.workoutEntries)
            .where(eq(tables.workoutEntries.workoutId, id))
            .run()
        writeWorkoutEntries(tx, id, parsed.entries)

        return updated
    })
})
