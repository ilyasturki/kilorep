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

	if (target.origin !== origin) {
		return AFTER_LOGIN;
	}

	if (target.pathname.replace(/\/+$/u, '') === LOGIN) {
		return AFTER_LOGIN;
	}

	return `${target.pathname}${target.search}${target.hash}`;
}
