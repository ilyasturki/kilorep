export default defineEventHandler(async (event) => {
    const userId = requireUserId(event)
    const body = await readBody<{ ids?: unknown[] }>(event)
    const ids = Array.isArray(body?.ids) ? body.ids.map(Number) : []
    if (
        ids.length === 0
        || !ids.every((id) => Number.isInteger(id) && id > 0)
    ) {
        badRequest('"ids" must be a non-empty array of session ids')
    }
    reorderSessions(userId, ids)
    return { ok: true }
})
