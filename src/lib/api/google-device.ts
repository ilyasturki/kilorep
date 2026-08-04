import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

import type { Account, MintedToken } from './auth.ts';
import { adoptToken, deviceLabel, googleStartUrl } from './auth.ts';
import { ApiError, OFFLINE, request } from './client.ts';
import { DEVICE_REDIRECT, GOOGLE_CLAIM_PATH } from './routes.ts';

function base64url(bytes: Uint8Array): string {
	const binary = String.fromCodePoint(...bytes);

	return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}

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

const RETURN = new URL(DEVICE_REDIRECT);

function isReturn(incoming: string): boolean {
	try {
		const url = new URL(incoming);

		return url.protocol === RETURN.protocol && url.host.toLowerCase() === RETURN.host.toLowerCase();
	} catch {
		return false;
	}
}

async function openAndWait(url: string): Promise<URL | null> {
	let settle!: (value: URL | null) => void;

	// oxlint-disable-next-line promise/avoid-new
	const returned = new Promise<URL | null>((resolve): void => {
		settle = resolve;
	});

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

		await Promise.all([opened.remove(), closed.remove()]);

		try {
			await Browser.close();
		} catch {
			// Already closed by the user, which is the common path.
		}
	}
}

export async function signInWithGoogle(): Promise<Account> {
	const verifier = newVerifier();

	const url = googleStartUrl({ challenge: await challengeFor(verifier) });

	const returned = await openAndWait(url);

	if (returned === null) {
		throw new ApiError(OFFLINE, 'sign-in was cancelled');
	}

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
