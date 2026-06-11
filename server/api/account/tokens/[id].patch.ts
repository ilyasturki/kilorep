// Renames a token. The util owns the label rules (trim, cap, non-empty).
export default defineEventHandler(async (event) => {
    requireAuthMode()
    const userId = requireUserId(event)
    const id = getIdParam(event, 'token')
    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    const record = renameApiToken(userId, id, body.label)
    if (!record) notFound(`No token with id ${id}`)
    return record
})
