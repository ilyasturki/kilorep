// Revokes a token. Scoped by userId like every query, so a foreign id reads
// as "no such token".
export default defineEventHandler((event) => {
    requireAuthMode()
    const userId = requireUserId(event)
    const id = getIdParam(event, 'token')
    if (!deleteApiToken(userId, id)) {
        notFound(`No token with id ${id}`)
    }
    return { ok: true }
})
