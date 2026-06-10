import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { registerBodyweightTools } from './bodyweight'
import { registerExerciseTools } from './exercises'
import { registerWorkoutTools } from './workouts'

/**
 * Builds the kilorep MCP server: task-shaped tools over the same drizzle/utils
 * layer the REST API uses, so an MCP client (Claude Code) can log workouts and
 * weigh-ins and query progress conversationally. A fresh instance is created
 * per request — the transport is stateless, so no state may live on it — and
 * every tool closes over the account the request authenticated as.
 */
export function createMcpServer(userId: number): McpServer {
    const server = new McpServer({ name: 'kilorep', version: '0.0.2' })
    registerWorkoutTools(server, userId)
    registerExerciseTools(server, userId)
    registerBodyweightTools(server, userId)
    return server
}
