import { redirect } from '@sveltejs/kit';

import { hintsOf } from '$lib/store/derive';
import { getStore } from '$lib/store/store';
import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';

import type { PageLoad, PageLoadEvent } from './$types';

// The event is annotated because `PageData` infers back through `proxy+page.js` to this
// return, and the type-aware lint resolves that circle to `any`, disabling its typed rules.
export const load: PageLoad = async ({ depends }: PageLoadEvent) => {
	depends(SESSION_DEP);

	if (activeWorkout.session === null) {
		redirect(307, '/workout');
	}

	const store = await getStore();
	const { lastPerformed, frequent } = await store.pickerData();

	return { store, lastPerformed, frequent, history: hintsOf(lastPerformed) };
};
