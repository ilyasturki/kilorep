import { App } from '@capacitor/app';
import { goto } from '$app/navigation';

import { remove } from '$lib/app/capacitor';
import { decideBack } from '$lib/nav/back';
import { parentOf, tabRoots } from '$lib/nav/bar.svelte';
import { backDepth } from '$lib/nav/depth';
import { closeTopOverlay, hasOpenOverlay, watchOverlays } from '$lib/ui/overlays';

import type { BackDecision } from '$lib/nav/back';

function decide(): BackDecision {
	return decideBack({
		pathname: location.pathname,
		overlayOpen: hasOpenOverlay(),
		tabRoots: tabRoots(),
		parentOf,
		depth: backDepth()
	});
}

async function minimize(): Promise<void> {
	try {
		await App.minimizeApp();
	} catch {
		/* empty */
	}
}

// What the app wants, and what Android has been told. Held here rather than read back from
// the bridge, which offers no getter. Both start true because the plugin enables its
// callback in `load()`, before any of this runs.
let wanted = true;
let told = true;

let pushing = false;

/**
 * Say whether the app wants the next back press, before there is one, and carry that across
 * to the bridge one call at a time.
 *
 * A loop rather than a call per change: an overlay closing as a navigation lands is two
 * changes inside one round-trip, and fired loose the one Android ended up believing would
 * be whichever reply came back last. A run ends only once the two agree, so a call that
 * changes nothing never reaches the bridge at all.
 *
 * Capacitor's plugin registers an `OnBackPressedCallback` the moment a `backButton`
 * listener exists, and an enabled callback is the app telling Android "I will handle
 * this". Android asks that question when the gesture *begins*, not when it commits — it
 * has to, because the answer decides whether the window shrinks toward the home screen
 * under the held finger. A press already dispatched is far too late to hand back, which
 * is why this is pushed on every navigation and every overlay instead of being decided
 * inside the listener. At a tab root the app wants nothing from back, and letting go of
 * it there is the whole of the animation a native app gets for free.
 *
 * Handing it over does not exit: since Android 12 the system's own back at the root of a
 * task moves the task to the background rather than finishing the activity, which is
 * `minimizeApp` by another name and with the animation attached. A running session
 * survives it exactly as it survives today.
 */
async function push(next: boolean): Promise<void> {
	wanted = next;

	if (pushing) {
		return;
	}

	pushing = true;

	while (wanted !== told) {
		const sending = wanted;

		try {
			await App.toggleBackButtonHandler({ enabled: sending });
		} catch {
			// An APK older than this bundle: the toggle is plugin 7.1, the listener is not.
			// Recorded as sent regardless — a method that is missing stays missing, and a
			// retry loop against it would never end.
		}

		told = sending;
	}

	pushing = false;
}

export function syncSystemBack(): void {
	if (!import.meta.env.APP_BUILD) {
		return;
	}

	void push(decide().kind !== 'minimize');
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
		const decision = decide();

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
				// Reached only inside the round-trip `push` takes: the press landed after the
				// app stopped wanting back and before Android was told. The old exit, without
				// the animation, which beats a press that does nothing at all.
				void minimize();
				break;
			}
		}
	});

	// The overlay stack is the half of `decideBack` that navigation never announces: a sheet
	// opening at a tab root turns a press Android was about to answer into one the app must.
	const unwatch = watchOverlays(syncSystemBack);

	syncSystemBack();

	return () => {
		unwatch();

		// Nothing is listening any more. The plugin does not disable its callback when the
		// last listener leaves, and an enabled callback with no one behind it swallows back
		// presses whole.
		void push(false);

		void remove(listener);
	};
}
