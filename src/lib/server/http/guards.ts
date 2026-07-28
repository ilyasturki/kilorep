import { error } from '@sveltejs/kit';

import type { Credential } from '../auth/session.ts';

/**
 * Narrows `locals.credential` for a protected endpoint.
 *
 * The 401 it can raise is unreachable in practice — `createHandle` already
 * refused the request before routing — and that is deliberate: this exists so a
 * handler can use the credential without an `if` that reads like a second,
 * competing security check. If the hook's allowlist ever grows a path that
 * needs a credential anyway, this fails closed rather than dereferencing null.
 */
export function requireCredential(locals: App.Locals): Credential {
	if (locals.credential === null) {
		error(401, 'authentication required');
	}

	return locals.credential;
}
