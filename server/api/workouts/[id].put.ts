export default defineEventHandler(async (event) => {
    const userId = requireUserId(event)
    const id = getIdParam(event, 'workout')
    const parsed = parseWorkoutInput(await readBody<WorkoutInput>(event))

    const updated = useDrizzle().transaction((tx) => {
        const existing = tx
            .select()
            .from(tables.workouts)
            .where(
                and(
                    eq(tables.workouts.id, id),
                    eq(tables.workouts.userId, userId),
                ),
            )
            .get()
        if (!existing) {
            notFound('Workout not found')
        }

        const row = tx
            .update(tables.workouts)
            .set({
                ...(parsed.name ? { name: parsed.name } : {}),
                startedAt: parsed.startedAt ?? existing.startedAt,
                completed: parsed.completed,
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
        writeWorkoutEntries(tx, userId, id, parsed.entries)

        return row
    })

    return {
        ...updated,
        // Recomputed on every save so the client's sync-back strip tracks the
        // just-persisted tree without a follow-up read.
        template: workoutTemplateStatus(
            userId,
            updated.sessionId,
            parsed.entries,
        ),
    }
})
