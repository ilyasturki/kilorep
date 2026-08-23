import { redirect } from '@sveltejs/kit';

import type { PageLoad } from './$types';

// The tab points straight at Templates. This exists so the segment a lifter can read off the
// address bar is an address, rather than the one URL in the app that answers nothing.
export const load: PageLoad = () => {
	redirect(307, '/plan/templates');
};
