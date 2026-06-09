import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
    compatibilityDate: '2025-07-15',
    devtools: { enabled: true },
    modules: ['@vueuse/nuxt', 'reka-ui/nuxt'],
    css: ['./app/assets/css/main.css'],
    app: {
        head: {
            // SSR default so the design tokens resolve on first paint; the
            // client's useColorMode corrects this from localStorage on mount.
            htmlAttrs: { 'data-theme': 'dark' },
            link: [
                {
                    rel: 'preconnect',
                    href: 'https://fonts.googleapis.com',
                },
                {
                    rel: 'preconnect',
                    href: 'https://fonts.gstatic.com',
                    crossorigin: '',
                },
                {
                    rel: 'stylesheet',
                    href: 'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap',
                },
            ],
        },
    },
    vite: {
        plugins: [tailwindcss()],
    },
})
