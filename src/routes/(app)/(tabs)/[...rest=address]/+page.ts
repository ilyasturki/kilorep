import { error, redirect } from '@sveltejs/kit';

import { legacyAddress } from '$lib/nav/legacy';

import type { PageLoad } from './$types';

// The server answers a moved address itself; the app build has no server, only this.
export const load: PageLoad = ({ url }) => {
	const moved = legacyAddress(url);

	if (moved !== null) {
		redirect(308, moved);
	}

	error(404, 'No such page');
};
