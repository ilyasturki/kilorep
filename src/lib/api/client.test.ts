import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	ApiError,
	DEFAULT_SERVER,
	NO_SERVER,
	apiBase,
	deviceToken,
	lastServer,
	request,
	setApiBase,
	setDeviceToken,
	setLastServer
} from './client.ts';

const CAPTURED: { url: string; init: RequestInit }[] = [];

beforeEach(() => {
	CAPTURED.length = 0;

	vi.stubGlobal(
		'fetch',
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
	setLastServer(null);
});

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

		expect(CAPTURED[0].url).toBe('https://gym.example.com/api/auth/session');
	});

	it('falls back to the origin when nothing is configured', () => {
		vi.stubGlobal('location', { origin: 'https://web.example.com' });
		setApiBase(null);

		expect(apiBase()).toBe('https://web.example.com');
	});

	it('names having no server rather than reporting a network fault', () => {
		const error = new ApiError(NO_SERVER, 'no server connected');

		expect(error.status).toBe(NO_SERVER);
		expect(error.status).not.toBe(0);
	});
});

describe('the default instance', () => {
	it('is an address a URL can be built on, scheme and all', () => {
		expect(() => new URL('/api/health', DEFAULT_SERVER)).not.toThrow();
		expect(new URL(DEFAULT_SERVER).protocol).toBe('https:');
	});

	it('carries no trailing slash, which `request` would double', () => {
		expect(DEFAULT_SERVER.endsWith('/')).toBe(false);
	});

	it('is never what `apiBase` falls back to on its own', () => {
		vi.stubGlobal('location', { origin: 'https://web.example.com' });
		setApiBase(null);

		expect(apiBase()).not.toBe(DEFAULT_SERVER);
	});
});

describe('the address somebody typed', () => {
	it('outlives the connection it was used for', () => {
		vi.stubGlobal('location', { origin: 'https://web.example.com' });

		setApiBase('https://gym.example.com');
		setLastServer('https://gym.example.com');

		setApiBase(null);

		expect(apiBase()).not.toBe('https://gym.example.com');
		expect(lastServer()).toBe('https://gym.example.com');
	});

	it('is nothing until a server is typed, so the field starts empty', () => {
		expect(lastServer()).toBeNull();
	});
});
