import { envFlag, envList, envText } from './env.ts';

/**
 * Settings the HTTP surface reads. Functions rather than constants so a value
 * is never frozen at import time — the server re-reads per request, which costs
 * nothing, and a test can set a variable and observe the effect.
 */

/**
 * Registration ships closed: `/api/auth/register` answers 404 unless this is
 * explicitly on.
 *
 * The first account on a fresh instance is made with `bun run account:create`,
 * which never touches the network — so a normal self-hosted install never opens
 * this at all. That is the point: with no local path to a first account, an
 * operator would have to enable registration, sign up, disable it and restart,
 * and that window is exactly the claimable-by-a-stranger failure this design
 * rejects. This flag exists for the day the instance genuinely has more than
 * one user.
 */
export function registrationOpen(): boolean {
	return envFlag('ALLOW_REGISTRATION');
}

/**
 * Inside the APK the WebView's origin is not the server's, so every call it
 * makes is cross-origin and the WebView enforces CORS on it — without these
 * headers a login POST fails before reaching a handler, and it fails looking
 * like a network error rather than an auth error.
 *
 * Which origin Capacitor actually presents depends on `androidScheme`, so all
 * three ship: `https://localhost` (the Android default), `capacitor://localhost`
 * (iOS, and Android when the scheme is set to `capacitor`) and `http://localhost`
 * (the legacy Android scheme).
 *
 * The web surface needs no entry — it is served by this same server, so its
 * requests are same-origin and CORS never applies to them.
 */
const CAPACITOR_ORIGINS = ['https://localhost', 'capacitor://localhost', 'http://localhost'];

/**
 * An operator's entry, reduced to the form a browser actually sends.
 *
 * An `Origin` header is always `scheme://host[:port]` — no trailing slash, no
 * path — so `https://kilorep.example.com/`, which is what copying out of an
 * address bar gives you, can never equal one. Compared as written it matches
 * nothing, silently: the preflight simply comes back without the header and the
 * app reports a network error, with the slash nowhere in the story.
 */
function toOrigin(entry: string): string | undefined {
	try {
		// Non-special schemes have an opaque origin and `URL` reports it as the
		// string "null", which would match nothing and, worse, would match a
		// literal `Origin: null` — the header a sandboxed iframe sends.
		const { origin } = new URL(entry);
		return origin === 'null' ? undefined : origin;
	} catch {
		return undefined;
	}
}

/**
 * Normalised once per distinct value rather than per call. Re-reading the
 * environment is deliberate and costs nothing; parsing URLs and warning about
 * the bad ones on every request is work and noise for a value that changes at
 * boot. Keying the memo on the raw string keeps the property that setting the
 * variable is enough to change the answer.
 */
let cached: { raw: string; origins: string[] } | undefined;

export function allowedOrigins(): string[] {
	const raw = envText('CORS_ORIGINS', '');

	if (cached === undefined || cached.raw !== raw) {
		const configured: string[] = [];

		for (const entry of envList('CORS_ORIGINS')) {
			const origin = toOrigin(entry);

			if (origin === undefined) {
				// The one thing worse than dropping it is dropping it in silence.
				console.warn(`CORS_ORIGINS: ignoring "${entry}" — not an origin a browser can send`);
			} else {
				configured.push(origin);
			}
		}

		cached = { raw, origins: [...CAPACITOR_ORIGINS, ...configured] };
	}

	return cached.origins;
}
