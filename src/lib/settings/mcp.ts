export function claudeCommand(endpoint: string, token: string): string {
	return `claude mcp add --transport http kilorep ${endpoint} --header "Authorization: Bearer ${token}"`;
}

export function mcpServersJson(endpoint: string, token: string): string {
	const config = {
		mcpServers: {
			kilorep: { type: 'http', url: endpoint, headers: { Authorization: `Bearer ${token}` } }
		}
	};

	return JSON.stringify(config, null, 2);
}
