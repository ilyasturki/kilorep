import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server';

import { getDatabase } from '$lib/server/db/client';
import { requireCredential } from '$lib/server/http/guards';
import { buildServer } from '$lib/server/mcp/server';

import type { RequestHandler } from './$types';

/**
 * MCP over Streamable HTTP, one server per request.
 *
 * Stateless on purpose: a session id would pin conversation state to one process, and this
 * server is a NixOS unit that restarts on every deploy. Nothing here needs to be remembered
 * between calls — each tool reads the records fresh — so the cost of statelessness is a
 * `Library` rebuilt per request, which is one indexed scan of one user's rows.
 *
 * `handle.ts` has already resolved the bearer token and answered 401 for anyone without one.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireCredential(locals);

	const server = buildServer(getDatabase(), user.id);
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true
	});

	await server.connect(transport);

	try {
		return await transport.handleRequest(request);
	} finally {
		// JSON mode resolves with a complete body, so nothing is still being written here.
		await server.close();
	}
};
