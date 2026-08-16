import { googleEnabled, listTokens } from '$lib/api/auth';
import { DEFAULT_SERVER, apiBase } from '$lib/api/client';

import type { PageLoad } from './$types';

async function offersGoogle(fetch: typeof globalThis.fetch): Promise<boolean> {
	const base = apiBase();

	return base === null || base === DEFAULT_SERVER || (await googleEnabled(fetch));
}

export const load: PageLoad = async ({ parent, fetch }) => {
	const { user } = await parent();

	const google = import.meta.env.APP_BUILD && user === null ? await offersGoogle(fetch) : false;

	if (user === null) {
		// `tokens: null` rather than `[]`: the screen hides the section instead of drawing it empty.
		return { tokens: null, google };
	}

	return { tokens: await listTokens(fetch), google };
};
