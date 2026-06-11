// Lists the user's MCP tokens — metadata only; the secret exists nowhere to
// return. Auth mode only: without auth configured, /mcp is already open
// inside the instance's own network boundary and tokens would be theater.
export default defineEventHandler((event) => {
    requireAuthMode()
    const userId = requireUserId(event)
    return listApiTokens(userId)
})
