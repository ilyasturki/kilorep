import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Deliberately does not load the SvelteKit plugin: these tests exercise the
 * server's database layer, which is plain TypeScript and needs no framework.
 *
 * Vitest rather than `bun test` because `node:sqlite` does not exist under Bun
 * — see STACK.md. Tests run under Node, so they touch real SQLite.
 */
export default defineConfig({
	resolve: {
		alias: { $lib: fileURLToPath(new URL('src/lib', import.meta.url)) }
	},
	test: {
		include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
		environment: 'node'
	}
});
