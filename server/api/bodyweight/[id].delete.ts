export default defineEventHandler((event) => {
    const userId = requireUserId(event)
    const id = getIdParam(event, 'weigh-in')

    const deleted = useDrizzle()
        .delete(tables.bodyweight)
        .where(
            and(
                eq(tables.bodyweight.id, id),
                eq(tables.bodyweight.userId, userId),
            ),
        )
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
