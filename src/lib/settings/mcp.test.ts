import { describe, expect, test } from 'vitest';

import { claudeCommand, mcpServersJson } from './mcp.ts';

const ENDPOINT = 'https://gym.example.com/api/mcp';
const TOKEN = 'kr_abc123';

describe('the MCP setup a minted token comes with', () => {
	test('a Claude Code command that registers the server over HTTP', () => {
		expect(claudeCommand(ENDPOINT, TOKEN)).toBe(
			'claude mcp add --transport http kilorep https://gym.example.com/api/mcp ' +
				'--header "Authorization: Bearer kr_abc123"'
		);
	});

	test('an mcpServers block naming the same server and header', () => {
		expect(JSON.parse(mcpServersJson(ENDPOINT, TOKEN))).toEqual({
			mcpServers: {
				kilorep: {
					type: 'http',
					url: ENDPOINT,
					headers: { Authorization: 'Bearer kr_abc123' }
				}
			}
		});
	});
});
