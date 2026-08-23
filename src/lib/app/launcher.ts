import { App } from '@capacitor/app';
import { goto } from '$app/navigation';

import { remove } from '$lib/app/capacitor';
import { shortcutRoute } from '$lib/app/shortcuts';

let pending: string | null = null;

// The router is not up when the layout's effects run, and a cold start from a shortcut
// arrives before the first page has settled. Flipped by the first `afterNavigate`, which
// is the earliest moment a `goto` is worth anything.
let ready = false;

function flush(): void {
	if (!ready || pending === null) {
		return;
	}

	const route = pending;
	pending = null;
	void goto(route);
}

function offer(url: string): void {
	const route = shortcutRoute(url);

	if (route !== null) {
		pending = route;
		flush();
	}
}

export function shortcutsReady(): void {
	if (!import.meta.env.APP_BUILD) {
		return;
	}

	ready = true;
	flush();
}

async function launched(): Promise<void> {
	try {
		const launch = await App.getLaunchUrl();

		if (launch !== undefined) {
			offer(launch.url);
		}
	} catch {
		// Nothing launched us by URL, or an APK that cannot say. Either way the app is
		// already where it opens.
	}
}

/**
 * The two ways a shortcut reaches the app.
 *
 * Warm, the intent arrives as `appUrlOpen`. Cold, there is no event at all — the bridge
 * keeps the launching intent's URL and hands it over on request, and hands over the same
 * one for the life of the process, which is why it is read here once and never again.
 * Both funnel through the same slot, so a second tap during a slow start replaces the
 * first rather than queueing behind it.
 */
export function wireShortcuts(): () => void {
	if (!import.meta.env.APP_BUILD) {
		return () => {
			/* empty */
		};
	}

	const listener = App.addListener('appUrlOpen', ({ url }) => {
		offer(url);
	});

	void launched();

	return () => {
		void remove(listener);
	};
}
