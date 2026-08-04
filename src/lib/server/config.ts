import { envFlag, envText } from './env.ts';

export function registrationOpen(): boolean {
	return envFlag('ALLOW_REGISTRATION');
}

export function googleClient(): { id: string; secret: string } | undefined {
	const id = envText('GOOGLE_CLIENT_ID', '');
	const secret = envText('GOOGLE_CLIENT_SECRET', '');

	if (id === '' || secret === '') {
		return undefined;
	}

	return { id, secret };
}

const CAPACITOR_ORIGINS = ['https://localhost', 'capacitor://localhost', 'http://localhost'];

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

let cached: { raw: string; origins: string[] } | undefined;

export function allowedOrigins(): string[] {
	const raw = envText('CORS_ORIGINS', '');

	if (cached === undefined || cached.raw !== raw) {
		const configured: string[] = [];

		for (const entry of raw.split(/[\s,]+/u).filter((part) => part !== '')) {
			const origin = toOrigin(entry);

			if (origin === undefined) {
				console.warn(`CORS_ORIGINS: ignoring "${entry}" — not an origin a browser can send`);
			} else {
				configured.push(origin);
			}
		}

		cached = { raw, origins: [...CAPACITOR_ORIGINS, ...configured] };
	}

	return cached.origins;
}
