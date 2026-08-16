import { App } from '@capacitor/app';
import { goto } from '$app/navigation';

import { decideBack } from '$lib/nav/back';
import { parentOf, tabRoots } from '$lib/nav/bar.svelte';
import { backDepth } from '$lib/nav/depth';
import { closeTopOverlay, hasOpenOverlay } from '$lib/ui/overlays';

async function minimize(): Promise<void> {
	try {
		await App.minimizeApp();
	} catch {
		/* empty */
	}
}

async function remove(listener: Promise<{ remove: () => Promise<void> }>): Promise<void> {
	try {
		const handle = await listener;
		await handle.remove();
	} catch {
		/* empty */
	}
}

// Registering any `backButton` listener is itself the decision: Capacitor
// stops walking webview history the moment one exists.
export function wireHardwareBack(): () => void {
	if (!import.meta.env.APP_BUILD) {
		return () => {
			/* empty */
		};
	}

	const listener = App.addListener('backButton', () => {
		const decision = decideBack({
			pathname: location.pathname,
			overlayOpen: hasOpenOverlay(),
			tabRoots: tabRoots(),
			parentOf,
			depth: backDepth()
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
