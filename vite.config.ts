import node from '@sveltejs/adapter-node';
import staticAdapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

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
const adapter =
	process.env.BUILD_TARGET === 'app'
		? staticAdapter({ pages: 'build/app', assets: 'build/app', fallback: 'index.html' })
		: node({ out: 'build/server' });

export default defineConfig({
	plugins: [
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
