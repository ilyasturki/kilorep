export default defineEventHandler(async (event) => {
    const userId = requireUserId(event)
    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    return createExercise(userId, body)
})
