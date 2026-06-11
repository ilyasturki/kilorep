export default defineEventHandler(async (event) => {
    const userId = requireUserId(event)
    const id = getIdParam(event, 'session')
    const parsed = parseSessionInput(await readBody<SessionInput>(event))
    return replaceSessionTree(userId, id, parsed)
})
