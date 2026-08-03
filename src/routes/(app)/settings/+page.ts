import { googleEnabled, listTokens } from '$lib/api/auth';
import { apiBase } from '$lib/api/client';

import type { PageLoad } from './$types';

/**
 * What Settings needs beyond the layout's session: the credential list, and —
 * on the phone — whether the connected server has an identity provider to
 * offer.
 *
 * `user: null` is the app running local-only — the layout already decided
 * that is an ordinary state, not an error — and with no account there are no
 * credentials to list. `tokens: null` rather than `[]` keeps the two cases
 * distinct on the screen: a section that does not apply, not an empty one.
 *
 * `google` is asked only where it can be acted on: the app build, pointed at a
 * server, with nobody signed in. The web asks the same question from
 * `(auth)/+layout.ts` for its own login screen, which the phone never visits —
 * signing in there happens here, in front of the address it belongs to.
 */
export const load: PageLoad = async ({ parent, fetch }) => {
	const { user } = await parent();

	const askGoogle = import.meta.env.APP_BUILD && user === null && apiBase() !== null;
	const google = askGoogle ? await googleEnabled(fetch) : false;

	if (user === null) {
		return { tokens: null, google };
	}

	return { tokens: await listTokens(fetch), google };
};
