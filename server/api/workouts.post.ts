export default defineEventHandler(async (event) => {
    const userId = requireUserId(event)
    const body = await readBody<{ sessionId?: number }>(event)
    const sessionId = Number(body?.sessionId)
    if (!Number.isInteger(sessionId) || sessionId <= 0) {
        throw createError({
            statusCode: 400,
            statusMessage: 'A valid "sessionId" is required',
        })
    }

    return useDrizzle().transaction((tx) =>
        copySessionToWorkout(tx, userId, sessionId),
    )
})
