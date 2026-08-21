import type { SyncStatus } from '$lib/sync/status';
import { onSyncStatus, syncStatus } from '$lib/sync/status';

// A singleton mirroring a singleton: the subscription is never dropped because the
// module it listens to lives exactly as long as this one does.
class SyncStatusHolder {
	public current: SyncStatus = $state(syncStatus());

	public constructor() {
		onSyncStatus((status) => {
			this.current = status;
		});
	}
}

export const syncState = new SyncStatusHolder();
