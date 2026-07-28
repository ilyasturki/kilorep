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
 * Where the server is.
 *
 * A function rather than a constant so importing this module touches no
 * globals: the marketing page at `/` is prerendered under Node, where
 * `location` does not exist, and a module-scope read would run during the
 * build for any route that transitively imported it.
 *
 * On the web surface the answer is the origin serving the page, because that
 * origin *is* the server. In the APK it will not be — the WebView's origin is
 * `capacitor://localhost` and the server is wherever the user configured it —
 * which is why every caller goes through this instead of writing `/api/…`
 * relative. That path works on web and 404s on the phone, and it fails as a
 * network error rather than anything that names the cause — CLAUDE.md hard rule
 * 4. The phone's answer is deferred with the rest of the Capacitor shell, which
 * is not installed yet: written today it would key off nothing and be rewritten.
 */
export function apiBase(): string {
	return location.origin;
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

	let response: Response;
	try {
		response = await fetch(`${apiBase()}${path}`, {
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
