import { error } from '@sveltejs/kit';

import type { Credential } from '../auth/session.ts';
import { googleClient } from '../config.ts';

export function requireCredential(locals: App.Locals): Credential {
	if (locals.credential === null) {
		error(401, 'authentication required');
	}

	return locals.credential;
}

export function requireGoogleClient(): { id: string; secret: string } {
	const client = googleClient();
	if (client === undefined) {
		error(404, 'not found');
	}

	return client;
}
