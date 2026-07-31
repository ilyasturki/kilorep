/**
 * The transport every call to the server goes through.
 *
 * Framework-free by the same rule the domain layer follows — nothing here
 * imports SvelteKit — so it runs identically in a `load`, in a component, and
 * one day in the sync worker.
 */

/**
 * A failure the server described, or one the network never let it describe.
 *
 * One type for both, because every caller has to handle both and a union of
 * `Response` and `TypeError` pushes that branch into every call site. `status`
 * is what separates them: any real HTTP status came from the server, and
 * `OFFLINE` means the request never arrived.
 */
export class ApiError extends Error {
	public readonly status: number;

	public constructor(status: number, message: string) {
		super(message);
		this.name = 'ApiError';
		this.status = status;
	}
}

/** `ApiError.status` when the request never reached a server at all. */
export const OFFLINE = 0;

/**
 * `ApiError.status` when there is no server to reach — nobody has connected
 * one yet.
 *
 * Distinct from `OFFLINE`, and the distinction is the whole point: offline
 * means a configured server did not answer, which is a fault and worth
 * reporting. This means the app is doing exactly what PRODUCT.md promises —
 * running standalone — and a caller that treated it as a fault would draw an
 * error screen over a working app. Negative so it can never collide with an
 * HTTP status.
 */
export const NO_SERVER = -1;

/**
 * Where the server is, or null when there is none.
 *
 * `null` is not an error state. PRODUCT.md: "the server is optional. The phone
 * is complete standalone: install, lift, export, forever." The app build ships
 * with no server configured and stays that way until someone connects one, so
 * null is the ordinary condition on the phone and the exceptional one on the
 * web, where the origin serving the page *is* the server.
 *
 * Never `location.origin` in the APK. The WebView's origin is `https://localhost`
 * — Capacitor's own local server, which has no `/api` — so a relative call, or
 * this function guessing, produces a 404 that surfaces as a network error with
 * nothing naming the cause. CLAUDE.md hard rule 4, and it will not show up in
 * Chrome.
 */
let configured: string | null = null;

/**
 * Where the app build keeps the URL between launches. localStorage and not the
 * IndexedDB store: `db.ts` holds records, and this single string has to be
 * readable synchronously, before the first request of the boot — the guard's
 * session read — decides whether a server exists at all.
 */
const SERVER_KEY = 'kilorep.server';

/** The stored URL has been consulted; `configured` is now the truth either way. */
let restored = false;

/**
 * A function, and the fallback read deferred to call time rather than resolved
 * at module scope: the marketing page at `/` is prerendered under Node, where
 * `location` does not exist, and a module-scope read would run during the build
 * for any route that transitively imported this file.
 */
export function apiBase(): string | null {
	if (import.meta.env.APP_BUILD && !restored) {
		restored = true;
		configured = localStorage.getItem(SERVER_KEY);
	}

	if (configured !== null) {
		return configured;
	}

	return import.meta.env.APP_BUILD ? null : location.origin;
}

/**
 * Points the client at a server — the settings screen connecting one, or
 * disconnecting it with `null`.
 *
 * Persisted only in the app build. On the web the origin serving the page is
 * the server and needs no remembering, and writing there would let a stored
 * URL silently shadow it on the next boot.
 */
export function setApiBase(base: string | null): void {
	configured = base;
	restored = true;

	if (import.meta.env.APP_BUILD) {
		if (base === null) {
			localStorage.removeItem(SERVER_KEY);
		} else {
			localStorage.setItem(SERVER_KEY, base);
		}
	}
}

/**
 * Whether `base` is a kilorep server that is up, asked before `setApiBase`
 * commits to it — the one call made to an address the client is not yet
 * pointed at, which is why it cannot go through `request`.
 *
 * Three answers, matching what the connect screen has to say: unreachable
 * (`OFFLINE` — a typo'd host and a downed server look identical from here),
 * reachable but not a kilorep server (whatever answered has no `/api/health`
 * speaking our shape — the status is the stranger's own), or fine.
 */
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

	const shape = typeof payload === 'object' && payload !== null && 'ok' in payload;

	if (!shape) {
		throw new ApiError(response.status, 'that address is not a kilorep server');
	}

	// `ok: false` is still kilorep — the health endpoint reporting its database
	// down. Connecting would only move the failure two taps later.
	if (!response.ok) {
		throw new ApiError(response.status, 'the server answered, but reports itself unhealthy');
	}
}

export type RequestOptions = {
	method?: string;
	/** Serialised as JSON. Omit for a GET. */
	body?: unknown;
	/**
	 * SvelteKit hands `load` its own `fetch`, which it uses for dependency
	 * tracking and relative resolution. Passing it through keeps a load-issued
	 * request a first-class one; everything else gets the global.
	 */
	fetch?: typeof globalThis.fetch;
};

/**
 * What the server says when it refuses. Both sources agree on the shape:
 * SvelteKit's `error()` serialises to `{ message }` for a non-HTML request,
 * and `handle.ts` builds its 401 and 503 by hand in the same form.
 */
function messageFrom(payload: unknown, fallback: string): string {
	if (typeof payload === 'object' && payload !== null && 'message' in payload) {
		const { message } = payload;
		if (typeof message === 'string' && message !== '') {
			return message;
		}
	}

	return fallback;
}

/**
 * One request, one of two outcomes: the parsed body, or an `ApiError`.
 *
 * A non-2xx is a throw rather than a returned discriminated union because the
 * callers are `load` functions and submit handlers, both of which already have
 * a natural place to catch — and neither of which has anything useful to do
 * with a failure except stop.
 */
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

	let response: Response;
	try {
		response = await fetch(`${base}${path}`, {
			method,
			headers: body === undefined ? undefined : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
	} catch {
		// `fetch` rejects for DNS, TLS, a refused connection and a CORS refusal
		// alike, and deliberately says which for none of them — so neither can
		// this. Anything more specific here would be invented.
		throw new ApiError(OFFLINE, 'could not reach the server');
	}

	let payload: unknown;

	// 204 is the success shape of both login and logout: no body to parse, and
	// asking for one gets a syntax error instead of an answer. Anything else is
	// parsed leniently — an error status with an empty or non-JSON body is still
	// an error, and losing it to a parse failure would report the wrong cause.
	if (response.status !== 204) {
		try {
			payload = await response.json();
		} catch {
			payload = undefined;
		}
	}

	if (!response.ok) {
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
