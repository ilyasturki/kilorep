/**
 * The service worker's runtime caches hold per-user API responses in a
 * browser-wide cache. Wiping them on every auth transition extends the
 * server's userId isolation to the offline layer — otherwise a second
 * account on the same browser could read the previous user's cached
 * workouts while offline. Everything except the workbox precache (the
 * user-agnostic app shell) goes, so new runtime caches are covered without
 * keeping a name list in sync with nuxt.config.ts.
 */
export async function clearUserCaches() {
    if (!('caches' in globalThis)) return
    const keys = await caches.keys()
    await Promise.all(
        keys
            .filter((key) => !key.startsWith('workbox-precache'))
            .map((key) => caches.delete(key)),
    )
}
