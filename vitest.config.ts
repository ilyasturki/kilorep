import { fileURLToPath } from 'node:url'
import { defineVitestConfig } from '@nuxt/test-utils/config'

// Domain logic runs on plain Node + better-sqlite3 (no DOM), so these tests use
// the `node` environment. The server modules lean on Nitro's build-time
// auto-imports (useDrizzle, tables, badRequest, …), which vitest doesn't apply;
// tests/server/setup.ts re-exposes them as globals and points useDrizzle() at an
// in-memory, migrated database. @nuxt/test-utils still registers the `nuxt`
// environment, so app/component tests can be added later under it.
export default defineVitestConfig({
    test: {
        environment: 'node',
        include: ['tests/server/**/*.test.ts'],
        setupFiles: ['tests/server/setup.ts'],
    },
    resolve: {
        alias: {
            '~~': fileURLToPath(new URL('./', import.meta.url)),
            '~': fileURLToPath(new URL('./app/', import.meta.url)),
        },
    },
})
