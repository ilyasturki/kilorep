export default defineEventHandler(async (event) => {
    const userId = requireUserId(event)
    const id = getIdParam(event, 'exercise')

    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    const targetId = Number(body.targetId)
    if (!Number.isInteger(targetId) || targetId <= 0) {
        badRequest('Invalid target exercise id')
    }
    if (targetId === id) {
        badRequest("An exercise can't be merged into itself")
    }

    return useDrizzle().transaction((tx) => {
        const ownedExercise = (exerciseId: number) =>
            tx
                .select()
                .from(tables.exercises)
                .where(
                    and(
                        eq(tables.exercises.id, exerciseId),
                        eq(tables.exercises.userId, userId),
                    ),
                )
                .get()

        const source = ownedExercise(id)
        if (!source) {
            notFound('Exercise not found')
        }
        // Same 400 as assertExercisesOwned: another user's target id and a
        // nonexistent one must be indistinguishable.
        const target = ownedExercise(targetId)
        if (!target) {
            badRequest('Unknown exercise id')
        }

        // Re-pointing can only touch this user's rows: the tree writers refuse
        // foreign exercise ids, so no other user's sessions or workouts can
        // reference the source.
        tx.update(tables.sessionExercises)
            .set({ exerciseId: targetId })
            .where(eq(tables.sessionExercises.exerciseId, id))
            .run()
        tx.update(tables.workoutExercises)
            .set({ exerciseId: targetId })
            .where(eq(tables.workoutExercises.exerciseId, id))
            .run()
        tx.delete(tables.exercises).where(eq(tables.exercises.id, id)).run()

        // The source's names live on as aliases so the picker still finds the
        // survivor when someone searches the merged-away name.
        const known = new Set(
            [target.name, ...target.aliases].map((a) => a.toLowerCase()),
        )
        const gained = [source.name, ...source.aliases].filter(
            (a) => !known.has(a.toLowerCase()),
        )
        return tx
            .update(tables.exercises)
            .set({ aliases: [...target.aliases, ...gained] })
            .where(eq(tables.exercises.id, targetId))
            .returning()
            .get()
    })
})
