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
		// Nothing to do if the platform refuses; the press is spent either way.
	}
}

async function remove(listener: Promise<{ remove: () => Promise<void> }>): Promise<void> {
	try {
		const handle = await listener;
		await handle.remove();
	} catch {
		// Teardown races an unmount; a listener that never attached is fine.
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
 * `goto` with `replaceState`: dropping a detail screen onto its tab root is
 * back, and back does not mint history. It is the fallback now rather than the
 * rule — a screen inside a tab walks real history whenever there is any — so it
 * fires on the cold paths, where minting an entry would be worst: a
 * notification tap has nothing behind it to begin with.
 *
 * `tabRoots()` is taken whole and nothing is added to it here. `/workout/live`
 * used to be appended at this call site, being the one address the tab list did
 * not supply — it sits under `/workout`, so untreated it is a screen *inside* a
 * tab: back would walk real history out of a live session, and with nothing
 * behind it fall back to `/workout`, the idle screen, which bounces a live
 * session straight back here for a keypress that visibly does nothing. As a
 * root it minimizes, which is what back does from every other tab and what it
 * should do from the middle of a set: the way out of a workout is FINISH, not
 * a hardware button.
 *
 * That was right and it was in the wrong file. Stated only here, the bar above
 * the same screen still believed `/workout/live` had a parent, and was only not
 * drawing a link to it because the screen happened to fill the slot the link
 * would have used. It is Train's `owns` now — one answer, read by the hardware
 * button and by the back link alike.
 */
export function wireHardwareBack(): () => void {
	if (!import.meta.env.APP_BUILD) {
		return () => {
			// Web: no listener was wired, so there is nothing to unwire.
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
