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
 * error. The store rides along for the writes this screen makes — every
 * correction under Edit, and the delete.
 *
 * `lastPerformed` is the insert sheet's, not this screen's: an exercise added
 * to a past workout is picked from the same catalog list as one added
 * mid-session, and those rows spell out when each was last performed. Nothing
 * on the record itself reads it — a session that has already happened takes no
 * hints.
 */
export const load: PageLoad = async ({ params }) => {
	const store = await getStore();
	const workout = await store.getWorkout(params.id);

	if (workout === null) {
		error(404, 'No such workout');
	}

	// `??`, not `=== null`: a record written before `templateId` existed carries
	// no such key at all, and `undefined` slipping past a strict null check
	// reaches `getTemplate` as an undefined IndexedDB key — a `DataError`, which
	// the screen shows as a bare 500. The type says `string | null`; the storage
	// boundary's assertion is what lets an older shape through it.
	const templateId = workout.templateId ?? null;

	const [template, lastPerformed] = await Promise.all([
		templateId === null ? null : store.getTemplate(templateId),
		store.lastPerformed()
	]);

	return { store, workout, template, lastPerformed };
};
