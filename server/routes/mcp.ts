import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

import { createMcpServer } from '~~/server/mcp'

/**
 * MCP endpoint (Streamable HTTP, stateless): a fresh server + transport per
 * request, no sessions to track. Scoped to the account the auth middleware
 * resolved, exactly like the REST API.
 */
export default defineEventHandler(async (event) => {
    const userId = requireUserId(event)

    // Without sessions there is no SSE push channel to GET and no session to
    // DELETE; only POSTed JSON-RPC messages are meaningful.
    if (event.method !== 'POST') {
        setResponseStatus(event, 405)
        return {
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Method not allowed' },
            id: null,
        }
    }

    const server = createMcpServer(userId)
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
    })
    event.node.res.on('close', () => {
        void transport.close()
        void server.close()
    })

    await server.connect(transport)
    await transport.handleRequest(
        event.node.req,
        event.node.res,
        await readBody(event),
    )
    // The transport writes the raw response itself; there is no body to hand back.
    return undefined
})
