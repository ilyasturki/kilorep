import { redirect } from '@sveltejs/kit';

import { getStore } from '$lib/store/store';
import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';
import { restTimer } from '$lib/workout/rest.svelte';

import type { PageLoad, PageLoadEvent } from './$types';

// The event is annotated because `PageData` infers back through `proxy+page.js` to this
// return, and the type-aware lint resolves that circle to `any`, disabling its typed rules.
export const load: PageLoad = async ({ depends }: PageLoadEvent) => {
	depends(SESSION_DEP);

	const store = await getStore();
	const { lastPerformed, frequent, history, grips } = await store.pickerData();

	// This address answers for itself: a launch that saved a snapshot and navigated straight
	// here — repeat, a template's own START — must not depend on `/train` having run first.
	// (A cold boot is already resumed by the app layout before this load runs.)
	if (activeWorkout.session === null) {
		const resume = await store.loadSnapshot();

		if (resume !== null) {
			activeWorkout.begin(history, resume, grips);
			restTimer.resume(resume.rest, resume.muted);
		}
	}

	if (activeWorkout.session === null) {
		redirect(307, '/train');
	}

	return { store, lastPerformed, frequent, history };
};
