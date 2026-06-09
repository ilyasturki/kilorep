import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    modules: ['@vueuse/nuxt', 'reka-ui/nuxt', '@nuxt/fonts', '@nuxt/icon'],
    css: ['./app/assets/css/main.css'],
    // Self-hosted via @nuxt/fonts.
    fonts: {
        families: [
            {
                name: 'Archivo',
                provider: 'google',
                // Variable weight range → one file covers the 400–900 weights
                // the UI uses (body 400, titles 800, wordmark 900).
                weights: ['100 900'],
                styles: ['normal'],
            },
            {
                name: 'JetBrains Mono',
                provider: 'google',
                weights: [400, 500, 600, 700],
                styles: ['normal'],
            },
        ],
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
                { rel: 'manifest', href: '/site.webmanifest' },
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
