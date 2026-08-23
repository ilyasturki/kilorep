/**
 * Where a long-press shortcut off the launcher icon lands.
 *
 * The URL is a message to ourselves rather than an address: nothing resolves it, the
 * intents in `android/app/src/main/res/xml/shortcuts.xml` name their target component
 * outright, and only the host and the name after it are read here. The scheme is
 * deliberately not checked — it is the app's own, but the debug and release builds
 * declare the same one and neither is the point.
 *
 * `null` for everything else, which includes the Google sign-in return (`host=auth`) that
 * arrives on the same event and belongs to `google-device.ts`.
 *
 * Kept apart from `$lib/app/launcher`, which is the half that talks to the bridge, for
 * the reason `nav/back.ts` is kept apart from `nav/hardware-back.ts`: the decision is
 * worth testing and the wiring is not testable.
 */
export function shortcutRoute(url: string): string | null {
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return null;
	}

	if (parsed.host !== 'shortcut') {
		return null;
	}

	switch (parsed.pathname.replace(/^\/+/u, '')) {
		// Not `/train/live`: whether a session exists is the store's answer, not the
		// launcher's, and `/train` is the address that asks it. `start=next` is the START
		// button under the thumb on the idle screen, pressed for the lifter.
		case 'train': {
			return '/train?start=next';
		}
		case 'weight': {
			return '/bodyweight';
		}
		default: {
			return null;
		}
	}
}
