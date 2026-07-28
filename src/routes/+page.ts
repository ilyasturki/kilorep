// The one prerendered, server-rendered route in the tree. The app is an SPA
// that ships to a WebView with no server — see `(app)/+layout.ts` — but this
// page is read by crawlers and link unfurlers, which do not run JavaScript, so
// it has to arrive as HTML.
export const ssr = true;
export const prerender = true;
