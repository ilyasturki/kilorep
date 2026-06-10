// Mints the MCP bearer token (see settings page). Auth mode only: without
// auth configured, /mcp is already open inside the instance's own network
// boundary and a token would be theater.
export default defineEventHandler((event) => {
    requireAuthMode()
    const userId = requireUserId(event)
    return { token: rotateApiToken(userId) }
})
