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

/** A trimmed value, or the fallback when unset or blank. */
export function envText(name: string, fallback: string): string {
	const value = process.env[name];
	if (value === undefined || value.trim() === '') {
		return fallback;
	}
	return value.trim();
}

/**
 * True only for an explicit, unambiguous yes.
 *
 * Anything else — unset, blank, `false`, `0`, a typo — is false, because every
 * flag read through here defaults to the closed position. A misspelled
 * `ALLOW_REGISTRATON=true` must leave registration shut rather than open it.
 */
export function envFlag(name: string): boolean {
	const value = process.env[name];
	if (value === undefined) {
		return false;
	}
	return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

/** A comma- or whitespace-separated list; blank entries dropped. */
export function envList(name: string): string[] {
	const value = process.env[name];
	if (value === undefined) {
		return [];
	}
	return value.split(/[\s,]+/u).filter((entry) => entry !== '');
}
