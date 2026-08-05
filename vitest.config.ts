import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Deliberately does not load the SvelteKit plugin: these tests exercise the
 * server's database layer, which is plain TypeScript and needs no framework.
 *
 * Vitest rather than `bun test` because `node:sqlite` does not exist under Bun.
 * Tests run under Node, so they touch real SQLite.
 */
export default defineConfig({
	resolve: {
		alias: { $lib: fileURLToPath(new URL('src/lib', import.meta.url)) }
	},

	/**
	 * The cost of the paragraph above: `define` comes from the plugin this config
	 * does not load, so anything the client reads off `import.meta.env` is
	 * `undefined` here unless restated.
	 *
	 * `APP_BUILD` is left alone deliberately — undefined is falsy, which is the
	 * web half, and that is the half these tests exercise. `DEFAULT_SERVER` is
	 * restated because undefined is not a plausible address, and a test that
	 * imported one would fail somewhere far from the reason.
	 */
	define: {
		'import.meta.env.DEFAULT_SERVER': JSON.stringify(
			process.env.DEFAULT_SERVER ?? 'https://kilorep.com'
		)
	},
	test: {
		include: ['src/**/*.test.ts', 'tests/**/*.test.ts']
	}
});
