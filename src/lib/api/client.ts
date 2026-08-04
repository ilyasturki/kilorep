export class ApiError extends Error {
	public readonly status: number;

	public constructor(status: number, message: string) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
	}
}

export const OFFLINE = 0;

export const NO_SERVER = -1;

let configured: string | null = null;

let credential: string | null = null;

/**
 * Where the app build keeps the URL between launches. localStorage and not the
 * IndexedDB store: `db.ts` holds records, and this single string has to be
 * readable synchronously, before the first request of the boot — the guard's
 * session read — decides whether a server exists at all.
 */
const SERVER_KEY = 'kilorep.server';

/**
 * And where it keeps the credential, for the same reason and with the same
 * timing: the guard asks whether there is a token before it asks anything of
 * the network.
 *
 * localStorage rather than a secure-storage plugin. The WebView's storage is
 * private to the app, so the threat this would defend against is a rooted
 * device with the screen unlocked — at which point the IndexedDB holding every
 * workout is open to the same attacker.
 */
const TOKEN_KEY = 'kilorep.token';

let restored = false;

/**
 * Deferred to call time rather than resolved at module scope: the marketing
 * page at `/` is prerendered under Node, where `localStorage` does not exist,
 * and a module-scope read would run during the build for any route that
 * transitively imported this file.
 */
function restore(): void {
	if (import.meta.env.APP_BUILD && !restored) {
		restored = true;
		configured = localStorage.getItem(SERVER_KEY);
		credential = localStorage.getItem(TOKEN_KEY);
	}
}

function persist(key: string, value: string | null): void {
	restored = true;

	if (!import.meta.env.APP_BUILD) {
		return;
	}

	if (value === null) {
		localStorage.removeItem(key);
	} else {
		localStorage.setItem(key, value);
	}
}

export function apiBase(): string | null {
	restore();

	if (configured !== null) {
		return configured;
	}

	return import.meta.env.APP_BUILD ? null : location.origin;
}

export function setApiBase(base: string | null): void {
	configured = base;
	persist(SERVER_KEY, base);
}

export function deviceToken(): string | null {
	restore();

	return credential;
}

export function setDeviceToken(token: string | null): void {
	credential = token;
	persist(TOKEN_KEY, token);
}

export async function checkServer(base: string): Promise<void> {
	let response: Response;
	try {
		response = await fetch(new URL('/api/health', base));
	} catch {
		throw new ApiError(OFFLINE, 'could not reach the server');
	}

	let payload: unknown;
	try {
		payload = await response.json();
	} catch {
		payload = undefined;
	}

	if (typeof payload !== 'object' || payload === null || !('ok' in payload)) {
		throw new ApiError(response.status, 'that address is not a kilorep server');
	}

	if (!response.ok) {
		throw new ApiError(response.status, 'the server answered, but reports itself unhealthy');
	}
}

export type RequestOptions = {
	method?: string;
	body?: unknown;
	fetch?: typeof globalThis.fetch;
};

function messageFrom(payload: unknown, fallback: string): string {
	if (typeof payload === 'object' && payload !== null && 'message' in payload) {
		const { message } = payload;
		if (typeof message === 'string' && message !== '') {
			return message;
		}
	}

	return fallback;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
	const { method = 'GET', body, fetch = globalThis.fetch } = options;

	const base = apiBase();

	// Before the URL is built, not after. Joining `null` produces the string
	// "null/api/…", which `fetch` resolves against the WebView's own origin and
	// answers with Capacitor's local server — a 404 that reads as a network
	// fault and names nothing.
	if (base === null) {
		throw new ApiError(NO_SERVER, 'no server connected');
	}

	const headers = new Headers();

	if (body !== undefined) {
		headers.set('content-type', 'application/json');
	}

	const token = deviceToken();
	if (token !== null) {
		headers.set('authorization', `Bearer ${token}`);
	}

	let response: Response;
	try {
		response = await fetch(`${base}${path}`, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body)
		});
	} catch {
		// `fetch` rejects for DNS, TLS, a refused connection and a CORS refusal
		// alike, and deliberately says which for none of them — so neither can
		// this. Anything more specific here would be invented.
		throw new ApiError(OFFLINE, 'could not reach the server');
	}

	let payload: unknown;

	if (response.status !== 204) {
		try {
			payload = await response.json();
		} catch {
			payload = undefined;
		}
	}

	if (!response.ok) {
		if (response.status === 401 && token !== null) {
			setDeviceToken(null);
		}

		throw new ApiError(
			response.status,
			messageFrom(payload, `request failed (${response.status})`)
		);
	}

	// The one assertion, and it is the boundary's: JSON off the wire is `unknown`
	// and no amount of typing here makes it otherwise. Narrowing it honestly
	// would mean a runtime validator on every response — worth having when the
	// domain endpoints arrive, and not something to fake in the meantime.
	// oxlint-disable-next-line typescript/no-unsafe-type-assertion
	return payload as T;
}
