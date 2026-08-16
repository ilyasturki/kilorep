import { redirect } from '@sveltejs/kit';

import { googleEnabled, session } from '$lib/api/auth';
import { resolveRedirect } from '$lib/api/redirect';

import type { LayoutLoad } from './$types';

export const ssr = false;
export const prerender = false;

export const load: LayoutLoad = async ({ url, fetch }) => {
	const google = googleEnabled(fetch);

	let signedIn = false;
	try {
		await session(fetch);
		signedIn = true;
	} catch {
		signedIn = false;
	}

	if (signedIn) {
		redirect(307, resolveRedirect(url.searchParams.get('redirectTo'), url.origin));
	}

	return { google: await google };
};
