/**
 * The one module that loads `.env`, and the one place a bare `process.env` read
 * belongs.
 *
 * Plain `process.env` rather than `$env/dynamic/private` on purpose:
 * `drizzle.config.ts`, `scripts/account.ts` and `scripts/seed.ts` run outside
 * SvelteKit entirely, and they must resolve the same configuration the server
 * does. `drizzle-kit` reads `.env` on its own and nothing else does, so without
 * this `bun run db:generate` would happily diff a file the server never opens.
 *
 * A real environment variable always wins — `loadEnvFile` fills gaps rather
 * than overwriting — so a container is unaffected by a `.env` that happens to
 * be lying around.
 */

try {
	process.loadEnvFile('.env');
} catch {
	// No `.env`; the callers' defaults stand. This is the normal case in production.
}

export function envText(name: string, fallback: string): string {
	const value = (process.env[name] ?? '').trim();
	return value === '' ? fallback : value;
}

/**
 * True only for an explicit, unambiguous yes.
 *
 * Anything else — unset, blank, `false`, `0`, a typo — is false, because every
 * flag read through here defaults to the closed position. A misspelled
 * `ALLOW_REGISTRATON=true` must leave registration shut rather than open it.
 */
export function envFlag(name: string): boolean {
	return ['1', 'true', 'yes', 'on'].includes(envText(name, '').toLowerCase());
}
