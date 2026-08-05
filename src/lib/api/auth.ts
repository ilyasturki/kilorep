import { ApiError, NO_SERVER, apiBase, request, setDeviceToken } from './client.ts';
import { GOOGLE_ENABLED_PATH, GOOGLE_START_PATH } from './routes.ts';

export type Account = {
	id: string;
	email: string;
	createdAt: number;
	/** Whether this is a first password or a replacement — the button's wording. */
	hasPassword: boolean;
	/** The server's verdict, never re-derived here. See `publicUser`. */
	currentPasswordRequired: boolean;
};

export type PublicToken = {
	id: string;
	label: string;
	kind: 'web' | 'device' | 'api';
	prefix: string;
	createdAt: number;
	lastUsedAt: number | null;
	expiresAt: number | null;
	current: boolean;
};

export type MintedToken = {
	token: string;
	credential: PublicToken;
};

type Fetch = typeof globalThis.fetch;

export async function login(email: string, password: string, fetch?: Fetch): Promise<void> {
	await request<undefined>('/api/auth/login', {
		method: 'POST',
		body: { email, password, client: 'web' },
		fetch
	});
}

export function deviceLabel(): string {
	const day = new Intl.DateTimeFormat('en-GB', {
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});

	return `Kilorep on Android · ${day.format(new Date())}`;
}

export async function logout(fetch?: Fetch): Promise<void> {
	try {
		await request<undefined>('/api/auth/logout', { method: 'POST', fetch });
	} finally {
		setDeviceToken(null);
	}
}

export async function session(fetch?: Fetch): Promise<{ user: Account }> {
	const result = await request<{ user: Account }>('/api/auth/session', { fetch });
	return result;
}

export async function adoptToken(token: string, fetch?: Fetch): Promise<Account> {
	setDeviceToken(token);

	const { user } = await session(fetch);

	return user;
}

export async function signInDevice(
	email: string,
	password: string,
	fetch?: Fetch
): Promise<Account> {
	const { token } = await request<MintedToken>('/api/auth/login', {
		method: 'POST',
		body: { email, password, client: 'device', label: deviceLabel() },
		fetch
	});

	return adoptToken(token, fetch);
}

/**
 * `current` is null exactly when the account was told it would not be asked —
 * `Account.currentPasswordRequired`. The field is left off the body entirely
 * rather than sent empty, so an account that does owe one cannot satisfy the
 * check with a blank string.
 */
export async function setPassword(
	password: string,
	current: string | null,
	revokeOthers: boolean,
	fetch?: Fetch
): Promise<void> {
	await request<undefined>('/api/auth/password', {
		method: 'POST',
		body: current === null ? { password, revokeOthers } : { password, current, revokeOthers },
		fetch
	});
}

/**
 * The account and everything the server holds for it, gone.
 *
 * The credential is dropped on success only, and never in a `finally`: a
 * mistyped address comes back 403 with the account still standing, and taking
 * the token away there would sign the phone out of a server it is still a user
 * of, mid-correction.
 */
export async function deleteAccount(email: string, fetch?: Fetch): Promise<void> {
	await request<undefined>('/api/auth/account', { method: 'DELETE', body: { email }, fetch });

	setDeviceToken(null);
}

export async function listTokens(fetch?: Fetch): Promise<PublicToken[]> {
	const tokens = await request<PublicToken[]>('/api/auth/tokens', { fetch });
	return tokens;
}

export async function createToken(label: string, fetch?: Fetch): Promise<MintedToken> {
	const minted = await request<MintedToken>('/api/auth/tokens', {
		method: 'POST',
		body: { label, kind: 'api' },
		fetch
	});

	return minted;
}

export async function revokeToken(id: string, fetch?: Fetch): Promise<void> {
	await request<undefined>(`/api/auth/tokens/${id}`, { method: 'DELETE', fetch });
}

export async function googleEnabled(fetch?: Fetch): Promise<boolean> {
	try {
		const { enabled } = await request<{ enabled: boolean }>(GOOGLE_ENABLED_PATH, { fetch });
		return enabled;
	} catch {
		return false;
	}
}

export function googleStartUrl(params: Record<string, string>): string {
	const base = apiBase();

	if (base === null) {
		throw new ApiError(NO_SERVER, 'no server connected');
	}

	const url = new URL(GOOGLE_START_PATH, base);

	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}

	return url.toString();
}
