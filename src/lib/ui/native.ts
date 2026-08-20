import { tapClick } from '$lib/ui/feedback';

// Everything that answers a tap, including the roles bits-ui puts on its own menu items,
// tabs and switches — those never pass through `press`, and on Android they click too.
// Text inputs are absent on purpose: the keyboard rising is already the reply to that tap.
const CLICKABLE = [
	'button',
	'a[href]',
	'summary',
	'input:is([type="checkbox"], [type="radio"])',
	'[role="button"]',
	'[role="link"]',
	'[role="tab"]',
	'[role="switch"]',
	'[role="checkbox"]',
	'[role="radio"]',
	'[role="option"]',
	'[role="menuitem"]',
	'[role="menuitemcheckbox"]',
	'[role="menuitemradio"]'
].join(',');

// Where the WebView's own long press is the right behaviour: typing needs a caret, a
// selection and a paste menu.
const TEXT = 'input:not([type="checkbox"]):not([type="radio"]), textarea, [contenteditable]';

function within(event: Event, selector: string): boolean {
	return event.target instanceof Element && event.target.closest(selector) !== null;
}

function refuse(event: Event): void {
	if (within(event, TEXT)) {
		return;
	}

	event.preventDefault();
}

// Deliberately not gated on `defaultPrevented`: SvelteKit's router prevents the default of
// every internal link click, which would take the sound off the tab bar and half the app.
// A click that should not sound is stopped instead — see `press` and `DragOrder.swallowClick`.
function sound(event: MouseEvent): void {
	if (within(event, CLICKABLE)) {
		tapClick();
	}
}

/**
 * The two things a packaged app owes Android and a browser tab does not.
 *
 * One click listener rather than 55: it sits on the document, so it catches the
 * components that build their own buttons as well as the ones wearing `press`. A tap
 * that a long press already swallowed never reaches here — `press` stops that click
 * dead on the element, capture phase, before it can bubble this far.
 *
 * And no grabbing. Long-pressing a weight to raise selection handles, or a link to be
 * offered its address, is the WebView showing through the app; there is no address bar
 * to paste any of it into. The browser keeps all of it, where copying is useful, which
 * is why this is stamped on `<html>` here instead of written into a media query.
 */
export function wireNativeFeel(): () => void {
	if (!import.meta.env.APP_BUILD) {
		return () => {
			/* empty */
		};
	}

	const root = document.documentElement;

	root.classList.add('native');

	const listeners = new AbortController();
	const { signal } = listeners;

	document.addEventListener('click', sound, { signal });
	// Non-passive by declaration: both of these exist to say no.
	document.addEventListener('contextmenu', refuse, { passive: false, signal });
	document.addEventListener('dragstart', refuse, { passive: false, signal });

	return () => {
		listeners.abort();
		root.classList.remove('native');
	};
}
