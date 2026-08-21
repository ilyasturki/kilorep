import { App } from '@capacitor/app';

import { remove } from '$lib/app/capacitor';
import { readSyncState, stopSyncing, syncPromptly } from '$lib/sync/client';

/**
 * The app coming back to the front, by whichever name the platform gives it.
 *
 * Android suspends the WebView with the screen, so a phone put away mid-backoff never
 * fires its timer; returning to the foreground is when it gets another go. The browser
 * calls that same moment `visibilitychange`. Exactly one of the two is wired — on
 * Android both fire, and the exchange would run twice for one foreground.
 */
function onForeground(wake: () => void): () => void {
	if (import.meta.env.APP_BUILD) {
		const resumed = App.addListener('resume', wake);

		return () => {
			void remove(resumed);
		};
	}

	function surfaced(): void {
		if (document.visibilityState === 'visible') {
			wake();
		}
	}

	document.addEventListener('visibilitychange', surfaced);

	return () => {
		document.removeEventListener('visibilitychange', surfaced);
	};
}

/**
 * The ways sync starts that are neither a write nor the launch.
 *
 * Without them the launch was the only unprompted sync there was: a phone that lost the
 * network mid-session held its records until the app was killed and reopened, and said
 * nothing meanwhile. Wired to the signed-in account, so signing out drops the listeners
 * and cancels whatever was already scheduled under it.
 */
export function wireSyncTriggers(userId: string | null): () => void {
	if (userId === null) {
		stopSyncing();

		return () => {
			/* empty */
		};
	}

	void readSyncState();

	// Bound to a const: TypeScript does not carry the null narrowing above into a
	// closure over a parameter.
	const owner = userId;

	function wake(): void {
		syncPromptly(owner);
	}

	// The network coming back is the event the retry ladder is waiting for; taking it
	// directly beats sitting out the rest of a five-minute rung.
	globalThis.addEventListener('online', wake);

	const stopForeground = onForeground(wake);

	return () => {
		// The account is leaving, not just this mount: anything already scheduled under
		// its id must not fire, or `claimOwner` re-stamps a disowned store as theirs.
		stopSyncing();

		globalThis.removeEventListener('online', wake);

		stopForeground();
	};
}
