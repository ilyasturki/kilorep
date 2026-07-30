import { envFlag, envList, envText } from './env.ts';

/**
 * Settings the HTTP surface reads. Functions rather than constants so a value
 * is never frozen at import time — the server re-reads per request, which costs
 * nothing, and a test can set a variable and observe the effect.
 */

/**
 * Whether this instance accepts new accounts. Ships closed.
 *
 * It governs one thing: what happens when a Google identity nobody has seen
 * before finishes signing in. Off, it is refused; on, it becomes an account.
 * Nothing else creates one over the network — the first account on a fresh
 * instance is made with `bun run account:create`, which never touches the
 * network, so a normal self-hosted install never opens this at all.
 *
 * Linking is deliberately *not* creation, and so is not gated by this: a Google
 * identity whose verified address already belongs to an account attaches to it
 * whatever this says. That is how an operator moves their CLI-made account onto
 * Google without ever opening the instance to strangers.
 */
export function registrationOpen(): boolean {
	return envFlag('ALLOW_REGISTRATION');
}

export type GoogleClient = { id: string; secret: string };

/**
 * The Google OAuth client, or nothing.
 *
 * Unset is the ordinary case and not a misconfiguration: a self-hosted instance
 * whose accounts all came from `account:create` needs no identity provider, and
 * the sign-in screen simply does not offer one.
 *
 * Resolved whole rather than as an id getter, a secret getter and a boolean.
 * "Is this configured" and "give me the values" are the same question, and
 * answering them separately lets a caller ask the second without the first —
 * which is how an empty client id reaches `verifyClaims`, where it is compared
 * against a token's `aud`. Having the values *is* the permission to proceed, so
 * a half-configured instance cannot be represented rather than merely guarded.
 *
 * The secret is a real secret — the first this project has had. It belongs in a
 * systemd `EnvironmentFile` or a container secret, never in the Nix store, which
 * is world-readable.
 */
export function googleClient(): GoogleClient | undefined {
	const id = envText('GOOGLE_CLIENT_ID', '');
	const secret = envText('GOOGLE_CLIENT_SECRET', '');

	if (id === '' || secret === '') {
		return undefined;
	}

	return { id, secret };
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
