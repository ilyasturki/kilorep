export default defineEventHandler((event) => {
    const id = getIdParam(event, 'weigh-in')

    const deleted = useDrizzle()
        .delete(tables.bodyweight)
        .where(eq(tables.bodyweight.id, id))
        .returning()
        .get()

    if (!deleted) {
        throw createError({
            statusCode: 404,
            statusMessage: 'Weigh-in not found',
        })
    }
    return deleted
})
