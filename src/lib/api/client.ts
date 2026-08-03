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
 * The device token, or null when the phone holds no credential for the server
 * it is pointed at.
 *
 * A separate axis from `configured`, and the two are genuinely independent: a
 * connected server with no token is the local-only fallback the app runs in
 * after a sign-out or a revocation, and it is an ordinary state rather than a
 * locked door. Nothing on the web ever sets this — the browser is same-origin
 * with its server and authenticates with the cookie it cannot read.
 */
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

/** The stored values have been consulted; the two above are now the truth either way. */
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

/**
 * Writes one of the two through to disk, or forgets it — the app-build rule
 * spelled once for both.
 *
 * `restored` is stamped whichever value moved: a setter has just made the
 * in-memory pair authoritative, and a later `restore()` reading disk over the
 * top of it would undo the write.
 */
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

/**
 * A function, and the fallback read deferred for the reason above — `location`
 * is the one that does not exist during the prerender.
 */
export function apiBase(): string | null {
	restore();

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
	persist(SERVER_KEY, base);
}

/**
 * The credential this device holds, or null.
 *
 * Read by the guard before it asks the server anything: on the phone "signed
 * in" is a local fact, and answering it with a round-trip would put the network
 * in front of a boot that has no need of one.
 */
export function deviceToken(): string | null {
	restore();

	return credential;
}

/**
 * Takes a minted device token, or forgets the one held — a sign-out, a
 * disconnect, or a 401 that proved the stored one is dead.
 *
 * Persisted under the same rule as the address, and for a sharper version of
 * the same reason: a token written on the web would be a second credential
 * shadowing the cookie, sent as a Bearer to the origin that just set one.
 */
export function setDeviceToken(token: string | null): void {
	credential = token;
	persist(TOKEN_KEY, token);
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

	// Built rather than passed as an object literal because both entries are
	// conditional: the phone has a token and no body on most calls, the browser
	// has a body and no token on some.
	const headers = new Headers();

	if (body !== undefined) {
		headers.set('content-type', 'application/json');
	}

	// The phone's whole identity. The browser reaches this with `token` null and
	// authenticates with the HttpOnly cookie it never sees — which is also why
	// `credentials` is left alone: the cookie rides a same-origin request by
	// default, and asking for it cross-origin is exactly what `cors.ts` refuses
	// to allow.
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
		// A 401 on a request that carried a Bearer is that Bearer's death
		// certificate — revoked from the token list, or belonging to an account
		// that is gone — and forgetting it here is what stops every later caller
		// re-asking a server that has already said no. Guarded on `token` rather
		// than on the status alone: login's own 401 and claim's carry no
		// credential, so neither can clear the one this device holds.
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
