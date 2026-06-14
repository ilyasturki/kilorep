import { appLocale } from '~/utils/appLocale'

// Seed the active locale before the app formats anything: the device first
// (set synchronously, before any component renders), then the user's saved pin
// if they have one. Non-blocking so a slow round-trip can't delay first paint;
// the formatters read appLocale reactively, so a differing pin just reflows.
// Client-only — formatting never runs during SSR.
export default defineNuxtPlugin(() => {
    appLocale.value = navigator.language
    $fetch<{ locale: string | null }>('/api/account/preferences')
        .then(({ locale }) => {
            if (locale) appLocale.value = locale
        })
        .catch(() => {})
})
