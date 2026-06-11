// Mints an MCP bearer token (see settings page). The cleartext in the
// response is the only time it ever leaves the server.
export default defineEventHandler(async (event) => {
    requireAuthMode()
    const userId = requireUserId(event)
    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    return createApiToken(userId, body.label)
})
