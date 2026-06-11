export default defineEventHandler(async (event) => {
    const userId = requireUserId(event)
    const parsed = parseSessionInput(await readBody<SessionInput>(event))
    return createSessionTree(userId, parsed)
})
