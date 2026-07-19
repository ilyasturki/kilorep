import { appLocale } from '~/utils/appLocale'

// Seed the active locale before the app formats anything: the device first
// (set synchronously, before any component renders), then the user's saved pin
// if they have one. Non-blocking so a slow round-trip can't delay first paint;
// the formatters read appLocale reactively, so a differing pin just reflows.
// Client-only — formatting never runs during SSR.
async function applyPinnedLocale() {
    try {
        const { locale } = await $fetch<{ locale: string | null }>(
            '/api/account/preferences',
        )
        if (locale) appLocale.value = locale
    } catch {
        // No pin reachable: the device locale set above stands.
    }
}

export default defineNuxtPlugin(() => {
    appLocale.value = navigator.language
    void applyPinnedLocale()
})
