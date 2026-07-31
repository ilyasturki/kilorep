import { listTokens } from '$lib/api/auth';

import type { PageLoad } from './$types';

/**
 * What Settings needs beyond the layout's session: the credential list.
 *
 * `user: null` is the app running local-only — the layout already decided
 * that is an ordinary state, not an error — and with no account there are no
 * credentials to list. `tokens: null` rather than `[]` keeps the two cases
 * distinct on the screen: a section that does not apply, not an empty one.
 */
export const load: PageLoad = async ({ parent, fetch }) => {
	const { user } = await parent();

	if (user === null) {
		return { tokens: null };
	}

	return { tokens: await listTokens(fetch) };
};
