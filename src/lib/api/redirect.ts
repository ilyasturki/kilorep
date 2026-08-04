/**
 * Where sign-in sends you, and the rule that decides whether the URL asking for
 * it is allowed to.
 *
 * The guard puts the attempted path in `?redirectTo=`, so the value is
 * attacker-supplied by construction: anyone can send a link to
 * `/login?redirectTo=…`. On a page whose whole job is collecting a password,
 * an unchecked value is a phishing primitive — sign in for real, get bounced
 * to a convincing copy, and the address bar corroborates the first half of the
 * story.
 */

/** Where the app opens when nothing asked for anywhere else: the Dashboard, home. */
export const AFTER_LOGIN = '/dashboard';

const LOGIN = '/login';

/**
 * The origin comes from the caller rather than `location`, and that is not only
 * for the tests. Both call sites already hold the authoritative URL — a `load`
 * gets `url`, the page reads `page.url` — so reaching for a global would be
 * consulting a second source about a fact already in hand.
 */
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

	// Sending someone from sign-in back to sign-in is at best a wasted round-trip
	// and at worst a loop, since the reverse guard resolves this same value again
	// on arrival. The trailing slash is stripped first because `/login/` reaches
	// the same route — SvelteKit redirects it there — and would otherwise slip
	// past a plain equality check.
	if (target.pathname.replace(/\/+$/u, '') === LOGIN) {
		return AFTER_LOGIN;
	}

	// Rebuilt from the parsed parts, never echoed from the input: what gets
	// navigated to is then exactly what was inspected.
	return `${target.pathname}${target.search}${target.hash}`;
}
