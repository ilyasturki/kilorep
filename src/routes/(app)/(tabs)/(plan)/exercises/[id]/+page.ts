import { error } from '@sveltejs/kit';

import { catalogById } from '$lib/catalog';
import type { Exercise } from '$lib/domain/exercise';
import { startable } from '$lib/domain/template';
import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	// Widened by hand: a route param is any string, so the index can miss.
	const exercise: Exercise | undefined = catalogById[params.id];

	if (exercise === undefined) {
		error(404, 'No such exercise');
	}

	const store = await getStore();

	const [past, lastPerformed, note, bodyweight] = await Promise.all([
		store.pastSessions(exercise.id),
		store.lastPerformed(),
		store.exerciseNote(exercise.id),
		store.listBodyweight()
	]);

	const templates = past.length === 0 ? await store.listTemplates() : [];
	const plans = startable(templates);

	return { exercise, past, lastPerformed, note, plans, bodyweight };
};
