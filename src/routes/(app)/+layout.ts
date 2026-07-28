// The app itself: the client bundle ships to a Capacitor WebView, where there
// is no server. See CLAUDE.md hard rule 5.
//
// This lives here rather than on the root layout because the root now also
// carries the marketing page at `/`, which is the one route that is prerendered
// and server-rendered. Every app route belongs under this group; a route added
// outside it gets SvelteKit's defaults (`ssr = true`) and will not survive the
// APK build.
export const ssr = false;
export const prerender = false;
