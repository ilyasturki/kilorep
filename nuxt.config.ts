import tailwindcss from '@tailwindcss/vite'

import pkg from './package.json'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: false },
    modules: ['@vueuse/nuxt', 'reka-ui/nuxt', '@nuxt/icon', 'nuxt-auth-utils'],
    // Aliased, not './app/…': under Vite 8 the relative form resolves against
    // the generated .nuxt/ virtual module instead of the project root, which
    // breaks `nuxt dev` outright ("Failed to resolve import").
    css: ['~/assets/css/main.css'],
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
    // The API contract the native Android client is generated from:
    // route metas annotate each handler, and
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
    vite: {
        plugins: [tailwindcss()],
    },
})
