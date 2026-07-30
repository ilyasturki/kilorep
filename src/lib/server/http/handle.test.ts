import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type { Handle, RequestEvent } from '@sveltejs/kit';

import { createUser, issueToken, revokeToken } from '../auth/accounts.ts';
import { SESSION_COOKIE } from '../auth/session.ts';
import type { Database } from '../db/client.ts';
import { createDatabase } from '../db/client.ts';
import { migrationsFolder } from '../db/config.ts';
import { runMigrations } from '../db/migrate.ts';
import type { User } from '../db/schema.ts';
import { createHandle } from './handle.ts';

/**
 * The hook is where authentication is enforced, so it is the one piece that
 * cannot be covered by testing the functions underneath it: a route handler
 * called directly never runs this, and "did we remember to guard that endpoint"
 * is precisely the question these answer.
 *
 * Called as the plain function it is — no server, no port, no `$app/environment`
 * to resolve, which is why `createHandle` lives apart from `hooks.server.ts`.
 */

const PASSWORD = 'correct horse battery';

type Options = {
	method?: string;
	origin?: string;
	bearer?: string;
	cookie?: string;
	/**
	 * What the router matched, which SvelteKit sets before this hook runs. Null
	 * by default — the pessimistic case, where the hook learns nothing from it
	 * and the pathname logic has to carry the guard on its own.
	 */
	routeId?: string | null;
};

type Outcome = {
	response: Response;
	locals: App.Locals;
	/** How many times the request was allowed through to a route. */
	resolved: number;
};

let directory: string;
let db: Database;
let handle: Handle;

beforeEach(() => {
	directory = mkdtempSync(path.join(os.tmpdir(), 'kilorep-hook-'));
	db = createDatabase(path.join(directory, 'test.db'));
	runMigrations(db, migrationsFolder);
	handle = createHandle(() => db);
});

afterEach(() => {
	// Closed before the directory goes: unlinking the file out from under an open
	// `DatabaseSync` is silent on Linux, an error on Windows, and a leaked
	// descriptor per test either way.
	db.$client.close();
	rmSync(directory, { recursive: true, force: true });
	delete process.env.CORS_ORIGINS;
});

async function run(
	pathname: string,
	options: Options = {},
	using: Handle = handle
): Promise<Outcome> {
	const url = new URL(`http://localhost${pathname}`);
	const headers = new Headers();

	if (options.origin !== undefined) {
		headers.set('origin', options.origin);
	}
	if (options.bearer !== undefined) {
		headers.set('authorization', `Bearer ${options.bearer}`);
	}

	const locals = {} as App.Locals;
	let resolved = 0;

	const event = {
		url,
		route: { id: options.routeId ?? null },
		request: new Request(url, { method: options.method ?? 'GET', headers }),
		locals,
		cookies: {
			get: (name: string): string | undefined =>
				name === SESSION_COOKIE ? options.cookie : undefined
		}
	} as unknown as RequestEvent;

	const response = await using({
		event,
		resolve: (): Response => {
			resolved += 1;
			return new Response('ok', { status: 200 });
		}
	});

	return { response, locals, resolved };
}

async function account(): Promise<{ user: User; token: string; tokenId: string }> {
	const user = await createUser(db, 'lifter@example.com', PASSWORD);
	const { token, record } = issueToken(db, user.id, 'Pixel 8', 'device');

	return { user, token, tokenId: record.id };
}

describe('enforcement', () => {
	test('refuses an unauthenticated api request before it reaches the route', async () => {
		const { response, resolved } = await run('/api/workouts');

		expect(response.status).toBe(401);
		// The route never ran. An endpoint nobody remembered to guard is still
		// guarded, which is the whole reason enforcement lives here.
		expect(resolved).toBe(0);
		await expect(response.json()).resolves.toEqual({ message: 'authentication required' });
	});

	test('opens exactly the paths nobody can hold a credential for yet', async () => {
		for (const pathname of [
			'/api/health',
			'/api/auth/login',
			'/api/auth/google',
			'/api/auth/google/start',
			'/api/auth/google/callback'
		]) {
			const { response, resolved, locals } = await run(pathname);

			expect(response.status).toBe(200);
			expect(resolved).toBe(1);
			expect(locals.credential).toBeNull();
		}
	});

	test('does not open a path that merely starts like a public one', async () => {
		// Membership, not a prefix match: `/api/health/secrets` is not health.
		const { response } = await run('/api/health/secrets');
		expect(response.status).toBe(401);
	});

	test('accepts a Bearer credential and hands the account to the route', async () => {
		const { user, token } = await account();
		const { response, resolved, locals } = await run('/api/workouts', { bearer: token });

		expect(response.status).toBe(200);
		expect(resolved).toBe(1);
		expect(locals.credential!.user.id).toBe(user.id);
		expect(locals.credential!.token.label).toBe('Pixel 8');
	});

	test('accepts the session cookie', async () => {
		const { user, token } = await account();
		const { response, locals } = await run('/api/workouts', { cookie: token });

		expect(response.status).toBe(200);
		expect(locals.credential!.user.id).toBe(user.id);
	});

	test('prefers the Bearer header when a request carries both', async () => {
		const { user } = await account();
		const { token: header } = issueToken(db, user.id, 'header', 'api');
		const { token: cookie } = issueToken(db, user.id, 'cookie', 'web');

		const { locals } = await run('/api/workouts', { bearer: header, cookie });

		expect(locals.credential!.token.label).toBe('header');
	});

	test('refuses a revoked credential', async () => {
		const { user, token, tokenId } = await account();
		revokeToken(db, user.id, tokenId);

		const { response, resolved } = await run('/api/workouts', { bearer: token });

		expect(response.status).toBe(401);
		expect(resolved).toBe(0);
	});

	test('refuses a secret that was never issued', async () => {
		const { response } = await run('/api/workouts', { bearer: 'kr_made-up' });
		expect(response.status).toBe(401);
	});

	test('guards a path SvelteKit will decode into an api path', async () => {
		// The router matches on the percent-decoded path and hands this hook the
		// raw one, so `/%61pi/workouts` reaches the `/api/workouts` handler while
		// a `startsWith('/api/')` on `event.url.pathname` reads it as a page.
		// Every encoded spelling of every guarded route rode on that gap.
		for (const pathname of ['/%61pi/workouts', '/%61%70%69/workouts', '/api/%77orkouts']) {
			const { response, resolved, locals } = await run(pathname);

			expect(response.status).toBe(401);
			expect(resolved).toBe(0);
			expect(locals.credential).toBeNull();
		}
	});

	test('does not let an encoded spelling reach the public allowlist either', async () => {
		// Membership is checked against the decoded path, so this is health —
		// answered, and answered with the CORS headers an API response owes.
		const { response, resolved } = await run('/%61pi/health', { origin: 'https://localhost' });

		expect(response.status).toBe(200);
		expect(resolved).toBe(1);
		expect(response.headers.get('access-control-allow-origin')).toBe('https://localhost');
	});

	test('still authenticates an encoded path that carries a valid credential', async () => {
		const { user, token } = await account();
		const { response, locals } = await run('/%61pi/workouts', { bearer: token });

		expect(response.status).toBe(200);
		expect(locals.credential!.user.id).toBe(user.id);
	});

	test('guards a page-shaped path the router matched to an api route', async () => {
		// Nothing reroutes today. If something ever does, the router's own answer
		// is already in `event.route.id` before this hook runs, and reading it
		// costs a page request one string comparison.
		const { response, resolved } = await run('/looks-like-a-page', {
			routeId: '/api/workouts'
		});

		expect(response.status).toBe(401);
		expect(resolved).toBe(0);
	});

	test('guards rather than crashes on a malformed escape', async () => {
		// `decodeURI('%zz')` throws. It matches no route either way, but the raw
		// form still has to land inside the guard rather than take the hook down.
		const { response, resolved } = await run('/api/%zz');

		expect(response.status).toBe(401);
		expect(resolved).toBe(0);
	});

	test('answers a database it cannot read with a status, not a dropped connection', async () => {
		const broken = createHandle(() => {
			throw new Error('SQLITE_BUSY: database is locked');
		});

		const { response, resolved } = await run(
			'/api/workouts',
			{ origin: 'https://localhost' },
			broken
		);

		expect(response.status).toBe(503);
		expect(resolved).toBe(0);
		// Without the header the APK sees a network error rather than a 503, and
		// cannot tell "the server is busy" from "there is no server".
		expect(response.headers.get('access-control-allow-origin')).toBe('https://localhost');
	});

	test('leaves page requests alone', async () => {
		const { user, token } = await account();
		const { response, resolved, locals } = await run('/', { bearer: token });

		expect(response.status).toBe(200);
		expect(resolved).toBe(1);
		// Null even for a valid credential: pages are client-rendered, nothing
		// reads this, and resolving it would cost a query per asset request.
		expect(locals.credential).toBeNull();
		expect(user.id).toBeDefined();
	});
});

describe('cors', () => {
	test('answers a preflight without reaching a route', async () => {
		const { response, resolved } = await run('/api/auth/login', {
			method: 'OPTIONS',
			origin: 'https://localhost'
		});

		expect(response.status).toBe(204);
		// A preflight carries no credentials by definition — it is the browser
		// asking whether it may send them.
		expect(resolved).toBe(0);
		expect(response.headers.get('access-control-allow-origin')).toBe('https://localhost');
		expect(response.headers.get('access-control-allow-methods')).toContain('POST');
		expect(response.headers.get('access-control-allow-headers')).toContain('authorization');
	});

	test('allows the Capacitor origins, whichever scheme the app was built with', async () => {
		for (const origin of ['https://localhost', 'capacitor://localhost', 'http://localhost']) {
			const { response } = await run('/api/health', { origin });
			expect(response.headers.get('access-control-allow-origin')).toBe(origin);
		}
	});

	test('refuses an origin nobody allowed, without failing the request', async () => {
		const { response, resolved } = await run('/api/health', { origin: 'https://evil.example' });

		// The absence of the header is the refusal; the browser enforces it.
		expect(response.headers.get('access-control-allow-origin')).toBeNull();
		expect(resolved).toBe(1);
	});

	test('varies on Origin even when refusing, so a cache cannot cross the wires', async () => {
		const { response } = await run('/api/health', { origin: 'https://evil.example' });
		expect(response.headers.get('vary')).toContain('Origin');
	});

	test('lets an operator add an origin', async () => {
		process.env.CORS_ORIGINS = 'https://kilorep.example.com, https://gym.example.com';

		const { response } = await run('/api/health', { origin: 'https://gym.example.com' });
		expect(response.headers.get('access-control-allow-origin')).toBe('https://gym.example.com');
	});

	test('forgives the trailing slash an address bar puts on a copied origin', async () => {
		// An `Origin` header never has one, so compared as written this entry
		// matched nothing — and said nothing about why.
		process.env.CORS_ORIGINS = 'https://kilorep.example.com/';

		const { response } = await run('/api/health', { origin: 'https://kilorep.example.com' });
		expect(response.headers.get('access-control-allow-origin')).toBe('https://kilorep.example.com');
	});

	test('reduces an entry with a path to the origin a browser would send', async () => {
		process.env.CORS_ORIGINS = 'https://kilorep.example.com:8443/app?x=1';

		const { response } = await run('/api/health', {
			origin: 'https://kilorep.example.com:8443'
		});
		expect(response.headers.get('access-control-allow-origin')).toBe(
			'https://kilorep.example.com:8443'
		);
	});

	test('drops an entry that is not an origin instead of letting it match', async () => {
		// `new URL('mailto:…').origin` is the string "null", which is also what a
		// sandboxed iframe sends as its Origin — matching it would grant access to
		// exactly the caller with none.
		process.env.CORS_ORIGINS = 'mailto:someone@example.com, not a url, https://ok.example.com';

		const opaque = await run('/api/health', { origin: 'null' });
		expect(opaque.response.headers.get('access-control-allow-origin')).toBeNull();

		// The one good entry in the list still works.
		const good = await run('/api/health', { origin: 'https://ok.example.com' });
		expect(good.response.headers.get('access-control-allow-origin')).toBe('https://ok.example.com');
	});

	test('stamps the 401 too, so the app sees the status instead of a network error', async () => {
		const { response } = await run('/api/workouts', { origin: 'https://localhost' });

		expect(response.status).toBe(401);
		expect(response.headers.get('access-control-allow-origin')).toBe('https://localhost');
	});

	test('never claims credentialed cross-origin access', async () => {
		const { response } = await run('/api/health', { origin: 'https://localhost' });

		// The dangerous half of CORS, and nothing needs it: the browser is
		// same-origin with the server and the APK sends a Bearer token.
		expect(response.headers.get('access-control-allow-credentials')).toBeNull();
	});
});
