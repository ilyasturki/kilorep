import { describe, expect, test } from 'vitest';

import { AFTER_LOGIN, resolveRedirect } from './redirect.ts';

/**
 * The one piece of this feature where a silent mistake is a security bug rather
 * than a broken screen, and the one piece that is pure enough to pin down here:
 * a wrong answer sends someone who just typed their password to an origin
 * chosen by whoever sent them the link.
 *
 * The origin is a parameter, so none of this needs a browser.
 */

const ORIGIN = 'https://kilorep.example.com';

describe('resolveRedirect', () => {
	test('falls back when nothing was asked for', () => {
		expect(resolveRedirect(null, ORIGIN)).toBe(AFTER_LOGIN);
		expect(resolveRedirect(undefined, ORIGIN)).toBe(AFTER_LOGIN);
		expect(resolveRedirect('', ORIGIN)).toBe(AFTER_LOGIN);
	});

	test('keeps a same-origin path, with its query and hash', () => {
		expect(resolveRedirect('/history', ORIGIN)).toBe('/history');
		expect(resolveRedirect('/history?week=3#top', ORIGIN)).toBe('/history?week=3#top');
	});

	test('accepts an absolute URL on this origin, reduced to a path', () => {
		expect(resolveRedirect(`${ORIGIN}/exercises?q=press`, ORIGIN)).toBe('/exercises?q=press');
	});

	test('refuses every spelling of somewhere else', () => {
		// Protocol-relative: the classic one, and the one a `startsWith('/')`
		// check waves straight through.
		expect(resolveRedirect('//evil.example', ORIGIN)).toBe(AFTER_LOGIN);
		// Backslashes, which browsers fold to slashes in a special scheme — so
		// this is the line above wearing a different coat.
		expect(resolveRedirect(String.raw`/\evil.example`, ORIGIN)).toBe(AFTER_LOGIN);
		expect(resolveRedirect(String.raw`\\evil.example`, ORIGIN)).toBe(AFTER_LOGIN);
		expect(resolveRedirect('https://evil.example/login', ORIGIN)).toBe(AFTER_LOGIN);
		// Same host, different scheme and port are different origins, and the
		// downgrade to http is the interesting half of that.
		expect(resolveRedirect('http://kilorep.example.com/start', ORIGIN)).toBe(AFTER_LOGIN);
		expect(resolveRedirect('https://kilorep.example.com:8443/start', ORIGIN)).toBe(AFTER_LOGIN);
	});

	test('refuses a scheme that is not navigation at all', () => {
		// The literal is the point of the case: this is the string an attacker
		// puts in the query, and a test that spelled it any other way would not
		// be testing what arrives.
		// oxlint-disable-next-line eslint/no-script-url
		expect(resolveRedirect('javascript:alert(1)', ORIGIN)).toBe(AFTER_LOGIN);
		expect(resolveRedirect('data:text/html,<h1>hi', ORIGIN)).toBe(AFTER_LOGIN);
	});

	test('refuses to send sign-in back to sign-in', () => {
		expect(resolveRedirect('/login', ORIGIN)).toBe(AFTER_LOGIN);
		expect(resolveRedirect('/login?redirectTo=/login', ORIGIN)).toBe(AFTER_LOGIN);
		// `/login/` reaches the same route, so an equality check alone would let
		// it through and the reverse guard would bounce it straight back.
		expect(resolveRedirect('/login/', ORIGIN)).toBe(AFTER_LOGIN);
	});

	test('does not mistake a longer path for the login route', () => {
		expect(resolveRedirect('/login-help', ORIGIN)).toBe('/login-help');
	});

	test('survives input that is not a URL', () => {
		// Resolved relative to the origin, so it stays on this site and is at
		// worst a 404 — which is the app's problem to render, not this rule's.
		expect(resolveRedirect('not a url', ORIGIN)).toBe('/not%20a%20url');
	});
});
