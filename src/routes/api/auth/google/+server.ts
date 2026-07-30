import { json } from '@sveltejs/kit';

import { googleClient } from '$lib/server/config';

import type { RequestHandler } from './$types';

/**
 * Whether this instance can offer Google sign-in at all.
 *
 * The login screen is client-rendered and has no other way to know: an
 * unconfigured instance must not draw a button that leads nowhere, and probing
 * `start` to find out would mean issuing a redirect to Google to answer a
 * question about the local server.
 *
 * Public, and it gives nothing away — the presence of the button says the same
 * thing to anyone who loads the page. It deliberately does *not* report whether
 * registration is open: that is a question about a specific identity, answered
 * once the identity is known, and a boolean here would only tell a stranger
 * whether it is worth trying.
 */
export const GET: RequestHandler = () => json({ enabled: googleClient() !== undefined });
