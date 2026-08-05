import { redirect } from '@sveltejs/kit';

import type { PageLoad } from './$types';

// The one prerendered, server-rendered route in the tree — on the web. The app
// is an SPA that ships to a WebView with no server (see `(app)/+layout.ts`),
// but this page is read by crawlers and link unfurlers, which do not run
// JavaScript, so it has to arrive as HTML.
//
// Both flip for the APK, where there is no crawler to serve and no server to
// render on. The build already said so before this line existed: adapter-static
// writes the SPA fallback to `index.html`, which is the same filename the
// prerendered landing page claims, and reported "Overwriting build/app/index.html
// with fallback page" on every app build. The page was never reaching the phone;
// it was being generated and then destroyed. This makes that the intent rather
// than a warning nobody reads. CLAUDE.md hard rule 5.
export const ssr = !import.meta.env.APP_BUILD;
export const prerender = !import.meta.env.APP_BUILD;

/**
 * `/` is the marketing page on the web and nothing at all in the APK, which
 * opens on Train — the leftmost tab, and the screen a gym app owes you first.
 * See `navTabs`, which is the one place that decides which tab leads; this
 * address and `AFTER_LOGIN` follow it rather than deciding anything of their
 * own.
 *
 * A redirect here rather than a start path in the Capacitor config, because
 * Capacitor has none to give — it loads `index.html` and the router decides the
 * rest. `import.meta.env.APP_BUILD` is substituted literally, so the web build
 * compiles this away to an empty load rather than carrying a branch it can
 * never take.
 */
export const load: PageLoad = () => {
	if (import.meta.env.APP_BUILD) {
		redirect(307, '/workout');
	}
};
