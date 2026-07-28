import { allowedOrigins } from '../config.ts';

/**
 * Cross-origin access for `/api/*`, which exists for exactly one client: the
 * APK. Its WebView runs on its own origin, so every call it makes to a server
 * is cross-origin and the WebView blocks it unless these headers say otherwise.
 *
 * Deliberately *not* credentialed. `Access-Control-Allow-Credentials` is the
 * dangerous half of CORS — it lets another origin make requests that carry the
 * session cookie — and nothing needs it: the browser is same-origin with the
 * server, and the APK authenticates with a Bearer token, which a cross-origin
 * page cannot obtain.
 *
 * One response escapes all of this and cannot be reached from the hook:
 * SvelteKit answers a trailing slash with a 308 during route resolution, before
 * `handle` is called at all. So `POST /api/auth/login/` — an `apiBase` joined
 * with one slash too many — comes back to the APK as an unlabelled redirect the
 * WebView refuses to follow, which looks like the network being down. Clients
 * must not send the trailing slash; there is no header this module can add to
 * a response it never sees.
 */

/** Everything a client may send. `authorization` is the one that matters. */
const ALLOWED_HEADERS = 'authorization, content-type';
const ALLOWED_METHODS = 'GET, POST, DELETE, OPTIONS';

/** A day. Preflights are pure overhead on a phone that syncs over mobile data. */
const MAX_AGE_SECONDS = 86_400;

function isAllowed(origin: string): boolean {
	return allowedOrigins().includes(origin);
}

/**
 * Stamps an API response with its cross-origin verdict.
 *
 * `Vary: Origin` goes on unconditionally, including on responses that are not
 * allowed: the verdict depends on the request's `Origin`, so a cache that
 * ignored it would serve one origin's answer to another.
 */
export function applyCors(response: Response, origin: string | null): Response {
	response.headers.append('vary', 'Origin');

	if (origin !== null && isAllowed(origin)) {
		response.headers.set('access-control-allow-origin', origin);
	}

	return response;
}

/**
 * Answers a preflight. The browser sends `OPTIONS` before any request carrying
 * an `Authorization` header, and refuses to send the real one until this
 * replies — so this is the first thing a phone ever gets from the server.
 *
 * 204 regardless of whether the origin is allowed; the allow headers are what
 * actually grant access, and their absence is the refusal.
 */
export function preflightResponse(): Response {
	return new Response(null, {
		status: 204,
		headers: {
			'access-control-allow-methods': ALLOWED_METHODS,
			'access-control-allow-headers': ALLOWED_HEADERS,
			'access-control-max-age': String(MAX_AGE_SECONDS)
		}
	});
}
