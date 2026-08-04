import { json } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

import {
	GOOGLE_CALLBACK_PATH,
	GOOGLE_CLAIM_PATH,
	GOOGLE_ENABLED_PATH,
	GOOGLE_START_PATH
} from '../../api/routes.ts';
import type { Credential } from '../auth/session.ts';
import { SESSION_COOKIE, bearerToken, resolveCredential } from '../auth/session.ts';
import type { Database } from '../db/client.ts';
import { applyCors, preflightResponse } from './cors.ts';

/**
 * The request pipeline for `/api/*`: identity, then enforcement, then CORS.
 *
 * Enforcement lives here rather than in each endpoint, and that is the whole
 * design. A route the author forgot to guard is protected by default; the only
 * way to expose one is to name it in `PUBLIC_API_PATHS`, where it is visible.
 * Every sync and domain endpoint added later inherits this the moment it exists.
 *
 * Separate from `hooks.server.ts` so it can be tested as what it is — a plain
 * function — without a server to boot or `$app/environment` to resolve. The
 * database arrives as a getter, not a value, so importing this module opens no
 * file: `hooks.server.ts` is imported during the build too, and the Capacitor
 * bundle has no database at all.
 */

/**
 * The Google routes are all four public by necessity: nobody holds a credential
 * before signing in, and the callback's whole job is to mint the first one —
 * `claim` finishes that job for the phone, authenticated by the code it presents
 * rather than by anything this hook could resolve. The capability endpoint joins
 * them because the login screen has to ask before it can draw itself.
 */
const PUBLIC_API_PATHS = new Set([
	'/api/health',
	'/api/auth/login',
	GOOGLE_ENABLED_PATH,
	GOOGLE_START_PATH,
	GOOGLE_CALLBACK_PATH,
	GOOGLE_CLAIM_PATH
]);

function isApiPath(pathname: string): boolean {
	return pathname === '/api' || pathname.startsWith('/api/');
}

/**
 * The path SvelteKit routed on, which is not the one it hands this hook.
 *
 * `find_route` runs against the percent-decoded path while `event.url.pathname`
 * stays exactly as it arrived, and the gap between the two is an authentication
 * bypass: `GET /%61pi/workouts` reaches the `/api/workouts` handler, while a
 * `startsWith('/api/')` on the raw string reads it as a page and waves it
 * through with no identity, no allowlist check and no CORS. Splitting on `%25`
 * first is what SvelteKit itself does — decoding it would turn a literal percent
 * in the path into the start of an escape nobody wrote.
 */
function routedPath(pathname: string): string {
	try {
		return pathname
			.split('%25')
			.map((part) => decodeURI(part))
			.join('%25');
	} catch {
		// A malformed escape matches no route, so this request is a 404 whatever
		// happens next; returning the raw form keeps it inside the guard anyway.
		return pathname;
	}
}

export function createHandle(database: () => Database): Handle {
	return async ({ event, resolve }) => {
		const pathname = routedPath(event.url.pathname);

		// Three readings of "is this the API", and any one of them is enough.
		// `route.id` is the router's own answer and is set before this hook runs,
		// so it covers a future `reroute` sending a page-shaped URL at an API
		// route; the raw pathname covers the reverse. Erring toward the guard
		// costs a page request one string comparison.
		const api =
			isApiPath(pathname) || isApiPath(event.url.pathname) || isApiPath(event.route.id ?? '');

		// Pages are client-rendered by decision (`ssr = false`), so nothing on the
		// page side reads an identity and resolving one would be a database query
		// per asset request.
		if (!api) {
			event.locals.credential = null;
			return resolve(event);
		}

		const origin = event.request.headers.get('origin');

		// Answered before authentication, because a preflight carries no
		// credentials by definition — the browser sends it precisely to ask
		// whether it may send them.
		if (event.request.method === 'OPTIONS') {
			return applyCors(preflightResponse(), origin);
		}

		// Bearer first: a phone that also happens to hold a cookie meant the
		// header, and a cookie silently overriding it would be surprising.
		const secret = bearerToken(event.request) ?? event.cookies.get(SESSION_COOKIE) ?? null;

		let credential: Credential | null;
		try {
			credential = resolveCredential(database(), secret);
		} catch (error) {
			// A throw here escapes before `applyCors` ever runs, and an API response
			// without that header reaches the APK as a network error rather than a
			// status — the exact failure `cors.ts` exists to prevent. SQLITE_BUSY
			// past the five-second busy timeout is the realistic way to get here.
			console.error('could not resolve a credential:', error);
			return applyCors(json({ message: 'database unavailable' }, { status: 503 }), origin);
		}

		event.locals.credential = credential;

		if (credential === null && !PUBLIC_API_PATHS.has(pathname)) {
			// Built here rather than thrown as SvelteKit's `error()`: this runs
			// before routing, where a throw can be rendered as an HTML error page,
			// and an API client deserves JSON.
			return applyCors(json({ message: 'authentication required' }, { status: 401 }), origin);
		}

		return applyCors(await resolve(event), origin);
	};
}
