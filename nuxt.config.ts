import tailwindcss from '@tailwindcss/vite'

import pkg from './package.json'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: false },
    modules: [
        '@vueuse/nuxt',
        'reka-ui/nuxt',
        '@nuxt/icon',
        'nuxt-auth-utils',
        '@vite-pwa/nuxt',
    ],
    css: ['./app/assets/css/main.css'],
    runtimeConfig: {
        public: {
            appVersion: pkg.version,
        },
        // Sealed-cookie session lifetime (nuxt-auth-utils): 30 days.
        session: {
            maxAge: 60 * 60 * 24 * 30,
        },
        // Where Google's ID-token signing keys are fetched from. Overridable
        // (NUXT_GOOGLE_JWKS_URL) so the isolation suite can serve its own
        // JWKS and sign its own Google-shaped tokens.
        googleJwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    },
    // The API contract the native Android client is generated from
    // (ADR-0004): route metas annotate each handler, and
    // scripts/export-openapi.mjs merges in openapi/components.json and writes
    // the committed spec. Dev-only — production never serves the spec.
    nitro: {
        experimental: {
            openAPI: true,
        },
        openAPI: {
            meta: {
                title: 'Kilorep API',
                description:
                    'Workout session manager and weight tracker. Sessions prescribe the plan; workouts record what actually happened in the gym.',
                version: pkg.version,
            },
        },
    },
    // Bundle the locally-installed @iconify-json/tabler set so icons resolve
    // offline with no Iconify API calls.
    icon: {
        serverBundle: 'local',
    },
    app: {
        head: {
            title: 'Kilorep',
            meta: [
                {
                    name: 'description',
                    content:
                        'Kilorep is a minimalist strength-training app: build sessions with supersets, sets and reps, with per-muscle targeting and weight tracking.',
                },
                { name: 'theme-color', content: '#0b0b0c' },
                { property: 'og:title', content: 'Kilorep' },
                {
                    property: 'og:description',
                    content:
                        'Build and track strength workouts — supersets, sets, reps and per-muscle targeting.',
                },
                { property: 'og:type', content: 'website' },
            ],
            link: [
                // Static so the manifest is in the served HTML: routes are
                // ssr:false and Firefox Android ignores a link injected after
                // hydration, downgrading install to a plain bookmark.
                { rel: 'manifest', href: '/manifest.webmanifest' },
                { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
                {
                    rel: 'icon',
                    type: 'image/png',
                    sizes: '32x32',
                    href: '/favicon-32.png',
                },
                {
                    rel: 'icon',
                    type: 'image/png',
                    sizes: '16x16',
                    href: '/favicon-16.png',
                },
                { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
            ],
        },
    },
    // The app is user-specific CRUD with no SEO value, so render it
    // client-side only by default. SSR is re-enabled for the root, reserved
    // for a future landing page where social previews and crawlability matter.
    routeRules: {
        '/**': { ssr: false },
        '/': { ssr: true },
    },
    pwa: {
        registerType: 'autoUpdate',
        manifest: {
            name: 'Kilorep',
            short_name: 'Kilorep',
            description:
                'Build and track strength workouts — supersets, sets, reps and per-muscle targeting.',
            start_url: '/',
            display: 'standalone',
            background_color: '#0b0b0c',
            theme_color: '#0b0b0c',
            icons: [
                { src: '/icon-192.png', type: 'image/png', sizes: '192x192' },
                { src: '/icon-512.png', type: 'image/png', sizes: '512x512' },
            ],
        },
        workbox: {
            globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
            // The module defaults navigateFallback to '/' but never precaches
            // it (Nuxt renders HTML at runtime), which makes the whole SW
            // throw at evaluation ('non-precached-url') — so precache '/'
            // ourselves, with a fresh revision per build so deploys refetch
            // the shell. The install-time fetch follows the '/' redirect and
            // stores the generic SPA shell, valid for every app route.
            additionalManifestEntries: [
                { url: '/', revision: Date.now().toString(36) },
            ],
            // Server-rendered endpoints must bypass the shell fallback:
            // OAuth redirects, API calls and the MCP transport.
            navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/mcp/],
            runtimeCaching: [
                {
                    // NetworkFirst over StaleWhileRevalidate: workouts can
                    // change from other devices and via the MCP server, so
                    // never paint stale data when the network is reachable.
                    // Only GETs are matched (Workbox's default method).
                    urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
                    handler: 'NetworkFirst',
                    options: {
                        cacheName: 'api',
                        networkTimeoutSeconds: 3,
                        expiration: { maxEntries: 64 },
                    },
                },
            ],
        },
    },
    vite: {
        plugins: [tailwindcss()],
    },
})
