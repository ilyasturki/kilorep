import { App } from '@capacitor/app';
import { goto } from '$app/navigation';

import { decideBack } from '$lib/nav/back';
import { navTabs } from '$lib/nav/bar.svelte';
import { closeTopOverlay, hasOpenOverlay } from '$lib/ui/overlays';

/**
 * Swallows every way a native call can fail to matter — the plugin missing,
 * the platform not Android, the app already backgrounded. Same argument as
 * `buzz` in `ui/haptics.ts`: none changes what the screen does next.
 */
async function minimize(): Promise<void> {
	try {
		await App.minimizeApp();
	} catch {
		// Deliberately silent — see above.
	}
}

async function remove(listener: Promise<{ remove: () => Promise<void> }>): Promise<void> {
	try {
		const handle = await listener;
		await handle.remove();
	} catch {
		// Deliberately silent — see above.
	}
}

/**
 * The one Capacitor `backButton` listener, wired by the root layout.
 *
 * Registering any listener is itself the decision: Capacitor stops walking
 * webview history the moment one exists, so every press below arrives here
 * and `decideBack` answers all of them. The policy lives in `back.ts` and
 * stays plain TS; this file is only the edge that reads the world — pathname,
 * the overlay stack, the bar's tabs — and performs the verdict.
 *
 * A no-op on the web on purpose: the browser's back button already does the
 * right thing there, and `APP_BUILD` is substituted at build time, so the
 * server bundle keeps no dead listener. Same platform-edge placement as
 * `ui/haptics.ts`.
 *
 * `goto` with `replaceState`: popping a detail screen back to its tab root is
 * back, and back does not mint history.
 */
export function wireHardwareBack(): () => void {
	if (!import.meta.env.APP_BUILD) {
		return () => {
			// The web build: nothing was wired, so there is nothing to unwire.
		};
	}

	const listener = App.addListener('backButton', () => {
		const decision = decideBack({
			pathname: location.pathname,
			overlayOpen: hasOpenOverlay(),
			tabRoots: navTabs().map((tab) => tab.href),
			historyLength: history.length
		});

		switch (decision.kind) {
			case 'close-overlay': {
				closeTopOverlay();
				break;
			}
			case 'goto': {
				void goto(decision.path, { replaceState: true });
				break;
			}
			case 'history-back': {
				history.back();
				break;
			}
			case 'minimize': {
				void minimize();
				break;
			}
		}
	});

	return () => {
		void remove(listener);
	};
}
