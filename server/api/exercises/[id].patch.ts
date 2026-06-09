export default defineEventHandler(async (event) => {
    const id = getIdParam(event, 'exercise')
    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    const values = parseExerciseInput(body)

    let updated
    try {
        updated = useDrizzle()
            .update(tables.exercises)
            .set(values)
            .where(eq(tables.exercises.id, id))
            .returning()
            .get()
    } catch (error) {
        asDuplicateNameError(error)
    }

    if (!updated) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Exercise not found',
        })
    }
    return updated
})
