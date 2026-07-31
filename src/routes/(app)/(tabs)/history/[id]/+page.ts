import { error } from '@sveltejs/kit';

import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

/**
 * The workout behind the id, or a 404 — unknown and tombstoned look the same
 * on purpose, because a deleted workout's deep link should say "gone" rather
 * than resurrect a record the tombstone exists to keep dead.
 *
 * The template rides along when it still exists; null when it never did or is
 * gone since, which the screen reads as "no plan to drift from" rather than an
 * error. The store rides along for the one write this screen can make — the
 * delete.
 */
export const load: PageLoad = async ({ params }) => {
	const store = await getStore();
	const workout = await store.getWorkout(params.id);

	if (workout === null) {
		error(404, 'No such workout');
	}

	const template = workout.templateId === null ? null : await store.getTemplate(workout.templateId);

	return { store, workout, template };
};
