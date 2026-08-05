export const AFTER_LOGIN = '/workout';

const LOGIN = '/login';

export function resolveRedirect(value: string | null | undefined, origin: string): string {
	if (value === undefined || value === null || value === '') {
		return AFTER_LOGIN;
	}

	let target: URL;
	try {
		target = new URL(value, origin);
	} catch {
		return AFTER_LOGIN;
	}

	// One comparison covers every known way of naming somewhere else, because
	// the parser has already normalised them all by this point: `//evil.com` is
	// protocol-relative, `/\evil.com` becomes the same thing (browsers fold
	// backslashes to slashes in special schemes), an absolute `https://evil.com`
	// says it outright, and `javascript:` resolves to the opaque origin, which is
	// the string "null" and equal to no real origin.
	if (target.origin !== origin) {
		return AFTER_LOGIN;
	}

	if (target.pathname.replace(/\/+$/u, '') === LOGIN) {
		return AFTER_LOGIN;
	}

	return `${target.pathname}${target.search}${target.hash}`;
}
