import type { PluginListenerHandle } from '@capacitor/core';

/**
 * Await a Capacitor listener handle and drop it.
 *
 * Teardown runs on paths that cannot report anything — an unmounting effect, a
 * departing account — so a handle that never arrived or refuses to go is dropped
 * silently rather than thrown into a caller with nowhere to put it.
 */
export async function remove(listener: Promise<PluginListenerHandle>): Promise<void> {
	try {
		const handle = await listener;

		await handle.remove();
	} catch {
		/* empty */
	}
}
