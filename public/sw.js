// Self-destroying service worker. Kilorep used to ship a Workbox PWA; it was
// retired, but browsers that registered the old worker keep serving its stale
// precached app shell on soft reloads, so a hard reload was needed to see a new
// deploy. The old worker re-fetches this URL on its update check; serving a
// valid script here lets it replace then remove itself and drop every cache, so
// the client falls back to the network permanently. Safe to delete once enough
// time has passed that no client still carries the old worker.
self.addEventListener('install', () => {
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            await self.registration.unregister()
            const keys = await caches.keys()
            await Promise.all(keys.map((key) => caches.delete(key)))
            const clients = await self.clients.matchAll({ type: 'window' })
            for (const client of clients) client.navigate(client.url)
        })(),
    )
})
