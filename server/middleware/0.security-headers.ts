// App-wide security headers, set before any route handler runs. Block
// MIME-sniffing, deny cross-origin framing (clickjacking), and add a minimal
// CSP that stops framing and <base>/plugin abuse. Scripts are deliberately
// unconstrained: a real script-src needs nonce wiring through Nuxt's hydration,
// which is its own pass. Same-origin framing stays allowed — the responsive
// harness in public/ iframes the app to check mobile layouts.
export default defineEventHandler((event) => {
    setHeader(event, 'X-Content-Type-Options', 'nosniff')
    setHeader(event, 'X-Frame-Options', 'SAMEORIGIN')
    setHeader(
        event,
        'Content-Security-Policy',
        "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
    )
})
