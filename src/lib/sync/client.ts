import { ApiError, request } from '$lib/api/client';
import type { Store } from '$lib/store/store';
import { getStore } from '$lib/store/store';

import type { SyncResponse } from './protocol.ts';
import { MAX_PUSH } from './protocol.ts';

const DEBOUNCE_MS = 3000;

async function exchangeOnce(store: Store, userId: string): Promise<boolean> {
	if (!(await store.claimOwner(userId))) {
		return false;
	}

	const dirty = await store.dirtyRecords();
	const body = {
		watermark: await store.watermark(),
		push: dirty.slice(0, MAX_PUSH)
	};

	let response: SyncResponse;

	try {
		response = await request<SyncResponse>('/api/sync', { method: 'POST', body });
	} catch (error) {
		if (error instanceof ApiError) {
			return false;
		}

		throw error;
	}

	await store.applyRemote(response.records);
	await store.acknowledge(response.acks);
	await store.setWatermark(response.watermark);

	return true;
}

export async function syncNow(userId: string, target?: Store): Promise<void> {
	try {
		const store = target ?? (await getStore());

		for (let round = 0; round < 10; round += 1) {
			if (!(await exchangeOnce(store, userId))) {
				return;
			}

			const remaining = await store.dirtyRecords();

			if (remaining.length === 0) {
				return;
			}
		}
	} catch {
		// Opportunistic and silent by design: a failed sync retries on the next.
	}
}

let timer: ReturnType<typeof setTimeout> | undefined;
let inFlight = false;
let again = false;

async function drain(userId: string): Promise<void> {
	if (inFlight) {
		again = true;

		return;
	}

	inFlight = true;

	try {
		do {
			again = false;
			await syncNow(userId);
		} while (again);
	} finally {
		inFlight = false;
	}
}

export function syncSoon(userId: string): void {
	clearTimeout(timer);

	timer = setTimeout(() => {
		void drain(userId);
	}, DEBOUNCE_MS);
}
