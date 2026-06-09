export default defineEventHandler(async (event) => {
    const id = getIdParam(event, 'weigh-in')
    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    const values = parseBodyweightInput(body)

    let updated
    try {
        updated = useDrizzle()
            .update(tables.bodyweight)
            .set(values)
            .where(eq(tables.bodyweight.id, id))
            .returning()
            .get()
    } catch (error) {
        // Moving a weigh-in onto a date that already has one trips the UNIQUE
        // constraint; surface it as a clear conflict instead of a 500.
        if (error instanceof Error && error.message.includes('UNIQUE')) {
            throw createError({
                statusCode: 409,
                statusMessage: 'You already have a weigh-in on that date',
            })
        }
        throw error
    }

    if (!updated) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Weigh-in not found',
        })
    }
    return updated
})
