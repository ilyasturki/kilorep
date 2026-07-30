import node from '@sveltejs/adapter-node';
import staticAdapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

/**
 * One tree, two artifacts (STACK.md, app shape):
 *
 * - `BUILD_TARGET=app` → `adapter-static` with a fallback, which is the bundle
 *   Capacitor wraps. Server endpoints are compiled and then silently omitted,
 *   which is precisely why a client must never call a bare relative `/api/…`.
 * - anything else → `adapter-node`, the server, which also hosts the SPA.
 *
 * Both are named explicitly by the `build:app` / `build:server` scripts, so
 * neither artifact is ever produced by accident, and they write to separate
 * directories — the two adapters both default to `build/`, where the second
 * build of the day silently replaces the first.
 */
const isAppBuild = process.env.BUILD_TARGET === 'app';

const adapter = isAppBuild
	? staticAdapter({ pages: 'build/app', assets: 'build/app', fallback: 'index.html' })
	: node({ out: 'build/server' });

/**
 * The dev styleguide, emptied for the app.
 *
 * `routes/dev/ui` is 258 kB compiled — nearly half the app bundle — and a
 * WebView has no address bar, so nothing in the APK could reach it anyway. Nix
 * already excludes it from the server artifact by fileset; this is the same
 * exclusion for the other one.
 *
 * A plugin rather than configuration because SvelteKit has none to offer:
 * `kit.files.routes` names the directory and nothing narrows it, so the only
 * place to intervene is the module graph. Emptying the source is enough — the
 * route entry survives in the manifest at a few bytes, and every import it
 * pulled in stops being reachable.
 */
function stripDevRoutes(): Plugin {
	return {
		name: 'kilorep-strip-dev-routes',
		enforce: 'pre',
		load(id: string): string | null {
			return id.includes('/src/routes/dev/') ? '' : null;
		}
	};
}

export default defineConfig({
	/**
	 * Which artifact is being built, readable from application code.
	 *
	 * A `define` rather than a `VITE_`-prefixed variable because the answer is
	 * decided by the build script, not by a `.env` file, and there is exactly one
	 * source of it — the same `process.env.BUILD_TARGET` the adapter switches on.
	 * Two switches reading two variables is how the bundle and the shell end up
	 * disagreeing about which one they are.
	 *
	 * Substituted literally, so `if (import.meta.env.APP_BUILD)` collapses at
	 * build time and the branch not taken is not shipped.
	 */
	define: {
		'import.meta.env.APP_BUILD': JSON.stringify(isAppBuild)
	},

	plugins: [
		...(isAppBuild ? [stripDevRoutes()] : []),
		tailwindcss(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/u).includes('node_modules') ? undefined : true
			},

			adapter
		})
	]
});
