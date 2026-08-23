import { describe, expect, it } from 'vitest';

import { shortcutRoute } from './shortcuts';

const SCHEME = 'io.github.ilyasturki.kilorep';

describe('shortcutRoute', () => {
	it('sends the Train shortcut at the START the idle screen offers', () => {
		expect(shortcutRoute(`${SCHEME}://shortcut/train`)).toBe('/train?start=next');
	});

	it('sends the Weight shortcut at the tab, which starts nothing', () => {
		expect(shortcutRoute(`${SCHEME}://shortcut/weight`)).toBe('/bodyweight');
	});

	// The debug build wears a suffixed application id and the same custom scheme, and the
	// intent names its component outright, so the scheme is never what identifies these.
	it('reads the host and not the scheme', () => {
		expect(shortcutRoute('kilorep://shortcut/train')).toBe('/train?start=next');
	});

	// The Google sign-in return rides the same `appUrlOpen` event.
	it('leaves the sign-in return to google-device.ts', () => {
		expect(shortcutRoute(`${SCHEME}://auth?code=abc`)).toBeNull();
	});

	it('refuses a name it does not know, and anything unparseable', () => {
		expect(shortcutRoute(`${SCHEME}://shortcut/settings`)).toBeNull();
		expect(shortcutRoute('not a url')).toBeNull();
	});
});
