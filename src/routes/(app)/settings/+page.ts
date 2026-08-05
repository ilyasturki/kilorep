import { googleEnabled, listTokens } from '$lib/api/auth';
import { DEFAULT_SERVER, apiBase } from '$lib/api/client';

import type { PageLoad } from './$types';

/**
 * Whether the Server section should draw a Google button, which is a question
 * about whichever server the form under it would sign in to — the connected
 * address if there is one, kilorep.com if there is not.
 *
 * The default instance is answered without asking it. A local-only phone makes
 * no network calls at all, and spending the first of them to be told what this
 * build already knows about its own instance would buy nothing; a server
 * somebody typed is a stranger and gets asked. The cost is that turning Google
 * off on kilorep.com would leave a button here that fails on tap — a config
 * change on one known host, against a round-trip on every Settings visit.
 */
async function offersGoogle(fetch: typeof globalThis.fetch): Promise<boolean> {
	const base = apiBase();

	return base === null || base === DEFAULT_SERVER || (await googleEnabled(fetch));
}

/**
 * What Settings needs beyond the layout's session: the credential list, and —
 * on the phone — whether the server the sign-in form points at has an identity
 * provider to offer.
 *
 * `user: null` is the app running local-only — the layout already decided
 * that is an ordinary state, not an error — and with no account there are no
 * credentials to list. `tokens: null` rather than `[]` keeps the two cases
 * distinct on the screen: a section that does not apply, not an empty one.
 *
 * `google` is asked only where it can be acted on: the app build, with nobody
 * signed in. The web asks the same question from `(auth)/+layout.ts` for its
 * own login screen, which the phone never visits — signing in there happens
 * here, in front of the address it belongs to.
 */
export const load: PageLoad = async ({ parent, fetch }) => {
	const { user } = await parent();

	const google = import.meta.env.APP_BUILD && user === null ? await offersGoogle(fetch) : false;

	if (user === null) {
		return { tokens: null, google };
	}

	return { tokens: await listTokens(fetch), google };
};
