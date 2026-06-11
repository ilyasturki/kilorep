export default defineEventHandler(async (event) => {
    const userId = requireUserId(event)
    const id = getIdParam(event, 'exercise')
    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    const values = parseExerciseInput(body)

    let updated
    try {
        updated = useDrizzle()
            .update(tables.exercises)
            .set(values)
            .where(
                and(
                    eq(tables.exercises.id, id),
                    eq(tables.exercises.userId, userId),
                ),
            )
            .returning()
            .get()
    } catch (error) {
        asDuplicateNameError(error)
    }

    if (!updated) {
        notFound('Exercise not found')
    }
    return updated
})
