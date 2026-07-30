import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The shell around the `BUILD_TARGET=app` bundle.
 *
 * `webDir` is `build/app` and never `build/server`: the two adapters write to
 * separate directories precisely so `cap sync` cannot pick up the wrong one —
 * see vite.config.ts. Syncing the server build would copy a tree with no
 * `index.html` fallback into the APK and produce a white screen.
 *
 * `androidScheme` is left at Capacitor's default of `https`, which puts the
 * WebView on `https://localhost`. Three consequences, each of which fails
 * silently:
 *
 * - That origin is not the server's, so every API call the APK makes is
 *   cross-origin. `src/lib/server/config.ts` already ships it in the CORS
 *   allowlist, alongside the `capacitor://` and `http://` spellings.
 * - `https://localhost/api/…` is answered by Capacitor's own local server,
 *   which has no such route — so a bare relative call 404s here and works in
 *   Chrome. CLAUDE.md hard rule 4; `apiBase()` is the enforcement.
 * - Changing the scheme later moves the origin, and a WebView treats that as a
 *   different site: cookies and local storage do not follow. Once anything is
 *   persisted on a device, this value is frozen.
 */
const config: CapacitorConfig = {
	appId: 'io.github.ilyasturki.kilorep',
	appName: 'Kilorep',
	webDir: 'build/app'
};

export default config;
