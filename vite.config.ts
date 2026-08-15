import node from '@sveltejs/adapter-node';
import staticAdapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import type { Plugin } from 'vite';

const isAppBuild = process.env.BUILD_TARGET === 'app';

const adapter = isAppBuild
	? staticAdapter({ pages: 'build/app', assets: 'build/app', fallback: 'index.html' })
	: node({ out: 'build/server' });

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
	define: {
		'import.meta.env.APP_BUILD': JSON.stringify(isAppBuild),
		'import.meta.env.DEFAULT_SERVER': JSON.stringify(
			process.env.DEFAULT_SERVER ?? 'https://kilorep.com'
		)
	},
	server: {
		watch: {
			ignored: ['**/.claude/**']
		}
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
