import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	ApiError,
	NO_SERVER,
	apiBase,
	deviceToken,
	request,
	setApiBase,
	setDeviceToken
} from './client.ts';

/**
 * The transport, and specifically the two things about it that cannot be seen
 * in Chrome: what `apiBase` answers when nothing is connected, and whether the
 * credential the phone holds actually leaves on the request.
 *
 * `APP_BUILD` is false under vitest, so what is exercised here is the in-memory
 * half of both — which is the half every call reads. Persistence is one
 * `localStorage` write behind a build flag; the deep-link and WebView paths that
 * surround it only exist on a device, and `docs/TESTING.md` is where that is
 * driven.
 */

const CAPTURED: { url: string; init: RequestInit }[] = [];

beforeEach(() => {
	CAPTURED.length = 0;

	vi.stubGlobal(
		'fetch',
		// Synchronous on purpose, matching `sync/client.test.ts`: `await fetch(…)`
		// takes a plain value, and a sync mock keeps the async lint rules out of a
		// fake.
		vi.fn((input: unknown, init: RequestInit = {}) => {
			CAPTURED.push({ url: String(input), init });

			return Response.json({ ok: true });
		})
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
	setApiBase(null);
	setDeviceToken(null);
});

/** The headers of the one request that was made, as a plain lookup. */
function sentHeaders(): Headers {
	expect(CAPTURED).toHaveLength(1);

	return new Headers(CAPTURED[0].init.headers);
}

describe('the credential on the wire', () => {
	it('sends the device token as a Bearer header', async () => {
		setApiBase('https://gym.example.com');
		setDeviceToken('kr_a-device-token');

		await request('/api/auth/session');

		expect(sentHeaders().get('authorization')).toBe('Bearer kr_a-device-token');
	});

	it('sends no authorization at all without one — the browser cookie case', async () => {
		setApiBase('https://gym.example.com');

		await request('/api/auth/session');

		expect(sentHeaders().has('authorization')).toBe(false);
	});

	it('still sets the content type for a body, with or without a token', async () => {
		setApiBase('https://gym.example.com');
		setDeviceToken('kr_a-device-token');

		await request('/api/sync', { method: 'POST', body: { watermark: 0, push: [] } });

		const headers = sentHeaders();
		expect(headers.get('content-type')).toBe('application/json');
		expect(headers.get('authorization')).toBe('Bearer kr_a-device-token');
	});

	it('forgets the token when it is cleared', () => {
		setDeviceToken('kr_a-device-token');
		expect(deviceToken()).toBe('kr_a-device-token');

		setDeviceToken(null);
		expect(deviceToken()).toBeNull();
	});
});

describe('where the requests go', () => {
	it('joins the configured base, without a relative path ever forming', async () => {
		setApiBase('https://gym.example.com');

		await request('/api/auth/session');

		// Hard rule 4 in one assertion: an absolute URL, not `/api/…`, which would
		// work here and 404 against Capacitor's local server in the APK.
		expect(CAPTURED[0].url).toBe('https://gym.example.com/api/auth/session');
	});

	it('falls back to the origin when nothing is configured', () => {
		vi.stubGlobal('location', { origin: 'https://web.example.com' });
		setApiBase(null);

		// The web surface's ordinary state: the page's own origin is the server.
		// The phone's null is the other branch of this same line, reachable only
		// with `APP_BUILD` set — the device is where that gets driven.
		expect(apiBase()).toBe('https://web.example.com');
	});

	it('names having no server rather than reporting a network fault', () => {
		const error = new ApiError(NO_SERVER, 'no server connected');

		// The distinction the layout guard branches on: a phone running standalone
		// is not a phone whose server is down.
		expect(error.status).toBe(NO_SERVER);
		expect(error.status).not.toBe(0);
	});
});
