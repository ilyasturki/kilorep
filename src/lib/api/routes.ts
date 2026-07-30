/**
 * Where the Google sign-in routes live, spelled once.
 *
 * Four modules across three layers need this same path: the handshake cookie is
 * scoped to it, the guard publishes the three endpoints under it, `callbackUri`
 * hands it to Google as the redirect URI, and the login page builds a link to
 * `start`. Written out in each of them, moving or renaming the route directory
 * became a four-file edit that produces no compile error when one is missed —
 * and every miss fails somewhere far from the edit: `redirect_uri_mismatch` on
 * Google's own page, or a handshake cookie the browser quietly stops sending,
 * which surfaces as "that sign-in expired" and points at the wrong thing.
 *
 * Here rather than under `$lib/server` because one of the four is client code:
 * SvelteKit refuses to bundle `$lib/server` into the browser, correctly.
 */

/** Also the handshake cookie's `Path` — the other two live under it. */
export const GOOGLE_BASE = '/api/auth/google';

/** The capability check the login screen makes before it draws the button. */
export const GOOGLE_ENABLED_PATH = GOOGLE_BASE;

export const GOOGLE_START_PATH = `${GOOGLE_BASE}/start`;

export const GOOGLE_CALLBACK_PATH = `${GOOGLE_BASE}/callback`;
