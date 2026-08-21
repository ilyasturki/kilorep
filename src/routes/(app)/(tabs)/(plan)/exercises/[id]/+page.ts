import { error, redirect } from '@sveltejs/kit';

import { catalogById } from '$lib/catalog';
import type { Exercise } from '$lib/domain/exercise';
import { startable } from '$lib/domain/template';
import { foldedTo } from '$lib/store/fold';
import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	// A slug that became a grip keeps its address and forwards it: the entry is gone from the
	// browse list, not from the web, and an old bookmark should land where the sets went.
	const folded = foldedTo(params.id);

	if (folded !== null) {
		redirect(307, `/exercises/${folded}`);
	}

	// Widened by hand: a route param is any string, so the index can miss.
	const exercise: Exercise | undefined = catalogById[params.id];

	if (exercise === undefined) {
		error(404, 'No such exercise');
	}

	const store = await getStore();

	const [gripped, lastPerformed, note, bodyweight] = await Promise.all([
		store.gripSessions(exercise.id),
		store.lastPerformed(),
		store.exerciseNote(exercise.id),
		store.listBodyweight()
	]);

	// Never trained, on any grip: `gripSessions` keeps no empty key.
	const templates = Object.keys(gripped).length === 0 ? await store.listTemplates() : [];
	const plans = startable(templates);

	return { exercise, gripped, lastPerformed, note, plans, bodyweight };
};
