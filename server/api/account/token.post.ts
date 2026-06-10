// Mints the MCP bearer token (see settings page). Auth mode only: without
// auth configured, /mcp is already open inside the instance's own network
// boundary and a token would be theater.
export default defineEventHandler((event) => {
    if (!authEnabled()) {
        throw createError({ statusCode: 404, statusMessage: 'Not Found' })
    }
    const userId = requireUserId(event)
    return { token: rotateApiToken(userId) }
})
