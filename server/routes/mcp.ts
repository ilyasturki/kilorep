import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

import { createMcpServer } from '~~/server/mcp'

/**
 * MCP endpoint (Streamable HTTP, stateless): a fresh server + transport per
 * request, no sessions to track. Exposed exactly like the REST API — the
 * VPN/loopback boundary that guards /api is the auth story here too.
 */
export default defineEventHandler(async (event) => {
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

    const server = createMcpServer()
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
})
