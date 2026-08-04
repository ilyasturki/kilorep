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
		return pathname;
	}
}

export function createHandle(database: () => Database): Handle {
	return async ({ event, resolve }) => {
		const pathname = routedPath(event.url.pathname);

		const api =
			isApiPath(pathname) || isApiPath(event.url.pathname) || isApiPath(event.route.id ?? '');

		if (!api) {
			event.locals.credential = null;
			return resolve(event);
		}

		const origin = event.request.headers.get('origin');

		if (event.request.method === 'OPTIONS') {
			return applyCors(preflightResponse(), origin);
		}

		const secret = bearerToken(event.request) ?? event.cookies.get(SESSION_COOKIE) ?? null;

		let credential: Credential | null;
		try {
			credential = resolveCredential(database(), secret);
		} catch (error) {
			console.error('could not resolve a credential:', error);
			return applyCors(json({ message: 'database unavailable' }, { status: 503 }), origin);
		}

		event.locals.credential = credential;

		if (credential === null && !PUBLIC_API_PATHS.has(pathname)) {
			return applyCors(json({ message: 'authentication required' }, { status: 401 }), origin);
		}

		return applyCors(await resolve(event), origin);
	};
}
