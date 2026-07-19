/**
 * Forces the SPA shell document to always revalidate. The shell embeds this
 * deploy's content-hashed /_nuxt chunk URLs; if a browser (or any proxy) reuses
 * a stale shell it points at chunks the next deploy deleted, which is why a hard
 * reload was needed to pick up a release. Only the extensionless navigation
 * routes are touched — hashed assets stay immutable and the public files (incl.
 * /sw.js) keep the asset handler's own revalidating caching.
 */
export default defineEventHandler((event) => {
    const path = event.path.split('?')[0]!
    if (path.startsWith('/_nuxt/') || path.startsWith('/api/')) return

    const lastSegment = path.slice(path.lastIndexOf('/') + 1)
    if (lastSegment.includes('.')) return

    setResponseHeader(event, 'cache-control', 'no-cache')
})
