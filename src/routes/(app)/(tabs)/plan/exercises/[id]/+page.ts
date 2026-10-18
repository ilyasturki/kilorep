import { error, redirect } from '@sveltejs/kit';

import { catalogById } from '$lib/catalog';
import type { Exercise } from '$lib/domain/exercise';
import { settleGrip } from '$lib/domain/grip';
import { plansWith, startable } from '$lib/domain/template';
import { foldedHref } from '$lib/exercises/link';
import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, url }) => {
	// A slug that became a grip keeps its address and forwards it: the entry is gone from the
	// browse list, not from the web, and an old bookmark should land where the sets went, on the
	// grip they became. The query rides along — it carries where `‹` walks back to.
	const folded = foldedHref(params.id, url.search);

	if (folded !== null) {
		redirect(307, folded);
	}

	// Widened by hand: a route param is any string, so the index can miss.
	const exercise: Exercise | undefined = catalogById[params.id];

	if (exercise === undefined) {
		error(404, 'No such exercise');
	}

	// Opened from a workout, the page starts on the grip in use there; otherwise on All (`null`).
	const asked = url.searchParams.get('grip');
	const grip = asked === null || asked === '' ? null : (settleGrip(exercise, asked) ?? null);

	const store = await getStore();

	const [past, lastPerformed, note, bodyweight, templates] = await Promise.all([
		store.pastSessions(exercise.id),
		store.lastPerformed(),
		store.exerciseNote(exercise.id),
		store.listBodyweight(),
		store.listTemplates()
	]);

	const plans = startable(templates);
	const programmedIn = plansWith(templates, exercise.id);

	return { exercise, grip, past, lastPerformed, note, plans, programmedIn, bodyweight };
};
