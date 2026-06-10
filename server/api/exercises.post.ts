export default defineEventHandler(async (event) => {
    const userId = requireUserId(event)
    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    const values = parseExerciseInput(body)

    try {
        return useDrizzle()
            .insert(tables.exercises)
            .values({ ...values, userId })
            .returning()
            .get()
    } catch (error) {
        asDuplicateNameError(error)
    }
})
