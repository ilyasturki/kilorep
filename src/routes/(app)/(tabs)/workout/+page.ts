import { redirect } from '@sveltejs/kit';

import { historyFrom, lastGripsFrom } from '$lib/store/derive';
import { getStore } from '$lib/store/store';
import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';

import type { PageLoad } from './$types';

export const load: PageLoad = async ({ depends }) => {
	depends(SESSION_DEP);

	const store = await getStore();

	// `lastPerformed()` is the same full history read as `listWorkouts()`, so the landing
	// tab reads it once and derives the hints here rather than paying for it twice.
	const [resume, templates, workouts] = await Promise.all([
		store.loadSnapshot(),
		store.listTemplates(),
		store.listWorkouts()
	]);

	const history = historyFrom(workouts);
	const grips = lastGripsFrom(workouts);

	if (activeWorkout.session === null && resume !== null) {
		activeWorkout.begin(history, resume, grips);
	}

	if (activeWorkout.session !== null) {
		redirect(307, '/workout/live');
	}

	return { history, grips, templates, workouts };
};
