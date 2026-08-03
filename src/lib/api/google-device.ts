import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

import type { Account, MintedToken } from './auth.ts';
import { adoptToken, deviceLabel, googleStartUrl } from './auth.ts';
import { ApiError, OFFLINE, request } from './client.ts';
import { DEVICE_REDIRECT, GOOGLE_CLAIM_PATH } from './routes.ts';

/**
 * Google sign-in on the phone, which is a different flow from the web's and not
 * a variation of it.
 *
 * Three facts force the shape. Google refuses OAuth inside an embedded WebView
 * (`disallowed_useragent`), so this cannot happen in the app's own window and
 * opens a Custom Tab instead. That browser is the system's, so what it ends up
 * holding — a cookie for the server's origin — is of no use to a WebView on
 * `https://localhost`. And the way back into the app is a custom scheme, which
 * on Android is claimed rather than owned, so the return URL is a channel to be
 * assumed public.
 *
 * Hence PKCE over our own last hop: a verifier is minted here and never leaves,
 * only its SHA-256 goes out with the request, and the deep link comes back
 * carrying a code that is worthless without the verifier. `device-codes.ts` is
 * the server's half.
 *
 * The one module under `$lib/api` that touches the shell. It belongs with the
 * calls it makes rather than with the navigation edges, because everything
 * except the two listeners below is this client's own protocol.
 */

/**
 * Bytes to base64url — the spelling both PKCE and the server's hashes use.
 *
 * `btoa` wants one character per byte, and every byte is below 128 here, so the
 * code-point spelling is the code-unit spelling. Spread rather than a loop
 * because these are 32 bytes, not a stream.
 */
function base64url(bytes: Uint8Array): string {
	const binary = String.fromCodePoint(...bytes);

	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

/** 256 bits from the platform CSPRNG, the same strength the server's secrets use. */
function newVerifier(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);

	return base64url(bytes);
}

/**
 * `crypto.subtle` needs a secure context, which the WebView is: Capacitor's
 * `androidScheme` default puts it on `https://localhost`. Moving that scheme to
 * `http` would break this — one more entry on the list in `capacitor.config.ts`
 * of things that value freezes.
 */
async function challengeFor(verifier: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));

	return base64url(new Uint8Array(digest));
}

/**
 * How long to wait after the Custom Tab closes before calling it a cancellation.
 *
 * The two events race. A deep link brings the app forward and finishes the tab,
 * so `browserFinished` can arrive either side of `appUrlOpen`, and treating it
 * as cancellation immediately would report failure on a sign-in that worked.
 * The cost of the grace period is paid only by someone who really did press
 * back, and half a second of a spinner is what they see.
 */
const CLOSE_GRACE_MS = 500;

/** The redirect's scheme and host, lowercased once for comparison. */
const RETURN = new URL(DEVICE_REDIRECT);

function isReturn(incoming: string): boolean {
	try {
		const url = new URL(incoming);

		return url.protocol === RETURN.protocol && url.host.toLowerCase() === RETURN.host.toLowerCase();
	} catch {
		// Not a URL at all, so not ours. Another app's deep link, most likely.
		return false;
	}
}

/**
 * Opens the Custom Tab and resolves with the URL the app was returned on, or
 * null if the person backed out of it.
 *
 * The promise is bridged from native events rather than awaited from a call,
 * which is what `new Promise` is for — the same case `password.ts` makes for
 * scrypt. The two listeners race and the loser is simply dropped: `resolve`
 * ignores every call after the first, so no guard of our own is needed.
 *
 * Both listeners are removed on every path, and so is the grace timer. An
 * `appUrlOpen` left registered would fire on the next sign-in as well, and
 * resolve a promise nobody is waiting on with a code that has already been
 * spent.
 */
async function openAndWait(url: string): Promise<URL | null> {
	let settle!: (value: URL | null) => void;

	// oxlint-disable-next-line promise/avoid-new
	const returned = new Promise<URL | null>((resolve): void => {
		settle = resolve;
	});

	// Held so the `finally` can drop it: on the success path the deep link brings
	// the app forward and finishes the tab too, leaving a timer scheduled against
	// a promise that has already settled.
	let grace: ReturnType<typeof setTimeout> | undefined;

	const opened = await App.addListener('appUrlOpen', ({ url: incoming }) => {
		if (isReturn(incoming)) {
			settle(new URL(incoming));
		}
	});

	const closed = await Browser.addListener('browserFinished', () => {
		grace = setTimeout(() => {
			settle(null);
		}, CLOSE_GRACE_MS);
	});

	try {
		await Browser.open({ url });

		return await returned;
	} finally {
		clearTimeout(grace);

		// Independent, and on the path where somebody is watching the app come back
		// to the foreground.
		await Promise.all([opened.remove(), closed.remove()]);

		// Idempotent, and needed on the success path: the deep link brings the app
		// forward without necessarily dismissing the tab behind it, and one left
		// open is a finished sign-in still sitting in the recents.
		try {
			await Browser.close();
		} catch {
			// Already gone, which is the ordinary case after a cancellation.
		}
	}
}

/**
 * The whole flow, from the button in Settings to a signed-in account.
 *
 * Throws `ApiError` for everything a caller has to render: `NO_SERVER` when
 * nothing is connected, `OFFLINE` when the person backed out of the browser —
 * there is nothing to report and nothing went wrong — and whatever the server
 * said for the rest.
 *
 * The verifier lives in memory for the duration, and that is a deliberate
 * bound: if Android reclaims the app while the Custom Tab is in front of it,
 * the return cold-starts a process that has no verifier and the code goes
 * unspent. It expires in a minute and the button is still there. Persisting it
 * would mean writing a live half-credential to disk to save a tap in the rarest
 * path there is.
 */
export async function signInWithGoogle(): Promise<Account> {
	const verifier = newVerifier();

	// Raises `NO_SERVER` when nothing is connected — the guard lives there, with
	// the `apiBase()` read it protects.
	const url = googleStartUrl({ challenge: await challengeFor(verifier) });

	const returned = await openAndWait(url);

	if (returned === null) {
		throw new ApiError(OFFLINE, 'sign-in was cancelled');
	}

	// The callback's own wording, already in the voice the rest of the screens
	// use — it wrote these for a person, not for a log.
	const failure = returned.searchParams.get('error');
	if (failure !== null) {
		throw new ApiError(OFFLINE, failure === '' ? 'sign-in was cancelled' : failure);
	}

	const code = returned.searchParams.get('code');
	if (code === null) {
		throw new ApiError(OFFLINE, 'that sign-in did not complete, try again');
	}

	const { token } = await request<MintedToken>(GOOGLE_CLAIM_PATH, {
		method: 'POST',
		body: { code, verifier, label: deviceLabel() }
	});

	return adoptToken(token);
}
