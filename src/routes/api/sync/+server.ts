import { error, json } from '@sveltejs/kit';

import { getDatabase } from '$lib/server/db/client';
import { syncExchange } from '$lib/server/db/sync';
import { readJsonBody } from '$lib/server/http/body';
import { requireCredential } from '$lib/server/http/guards';
import type { SyncRequest, WireRecord } from '$lib/sync/protocol';
import { MAX_PUSH, isWireRecord } from '$lib/sync/protocol';

import type { RequestHandler } from './$types';

function readWatermark(body: Record<string, unknown>): number {
	const value = body.watermark;

	if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
		error(400, 'watermark must be a number >= 0');
	}

	return value;
}

function readPush(body: Record<string, unknown>): WireRecord[] {
	const value = body.push;

	if (!Array.isArray(value)) {
		error(400, 'push must be an array of records');
	}

	if (value.length > MAX_PUSH) {
		error(400, `push holds at most ${MAX_PUSH} records`);
	}

	if (!value.every((item) => isWireRecord(item))) {
		error(400, 'push holds a malformed record');
	}

	return value;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = requireCredential(locals);

	const body = await readJsonBody(request);
	const sync: SyncRequest = { watermark: readWatermark(body), push: readPush(body) };

	return json(syncExchange(getDatabase(), user.id, sync));
};
