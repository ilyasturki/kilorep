import { redirect } from '@sveltejs/kit';

import type { PageLoad } from './$types';

export const ssr = !import.meta.env.APP_BUILD;
export const prerender = !import.meta.env.APP_BUILD;

export const load: PageLoad = () => {
	if (import.meta.env.APP_BUILD) {
		redirect(307, '/train');
	}
};
