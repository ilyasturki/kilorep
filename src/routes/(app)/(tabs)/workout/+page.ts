import { redirect } from '@sveltejs/kit';

import { hintsOf } from '$lib/store/derive';
import { getStore } from '$lib/store/store';
import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';

import type { PageLoad } from './$types';

export const load: PageLoad = async ({ depends }) => {
	depends(SESSION_DEP);

	const store = await getStore();

	const [lastPerformed, resume, templates, workouts] = await Promise.all([
		store.lastPerformed(),
		store.loadSnapshot(),
		store.listTemplates(),
		store.listWorkouts()
	]);

	const history = hintsOf(lastPerformed);

	if (activeWorkout.session === null && resume !== null) {
		activeWorkout.begin(history, resume);
	}

	if (activeWorkout.session !== null) {
		redirect(307, '/workout/live');
	}

	return { store, history, templates, workouts };
};
