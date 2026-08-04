import { error } from '@sveltejs/kit';

import { jsonObject } from '../json.ts';

/**
 * Reading a JSON request body without trusting a byte of it.
 *
 * Every failure here is a 400 with a field name, because the client that sent
 * it is the APK or an MCP config and the person debugging it has no server log.
 */

export async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
	const body = await jsonObject(request);

	if (body === undefined) {
		error(400, 'expected a JSON object');
	}

	return body;
}

/**
 * A non-blank string field, returned exactly as sent — never trimmed, because
 * one of the callers is a password and its spaces are the user's business.
 */
export function requiredString(body: Record<string, unknown>, field: string): string {
	const value = body[field];

	if (typeof value !== 'string' || value.trim() === '') {
		error(400, `${field} is required`);
	}

	return value;
}
