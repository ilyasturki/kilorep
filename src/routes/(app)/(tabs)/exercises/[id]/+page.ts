import { error } from '@sveltejs/kit';

import { catalogById } from '$lib/catalog';
import type { Exercise } from '$lib/domain/exercise';
import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

/**
 * Resolved here rather than in the component so an unknown slug is a 404 and
 * not a screen full of undefined — a stale link from an old record should say
 * "gone", loudly, because a missing catalog entry is an authoring bug (slugs
 * are never deleted).
 */
export const load: PageLoad = async ({ params, depends }) => {
	// Named so `Set as main` can re-run this load in place: the promotion is a
	// store write on a screen that stays put, which is exactly the situation
	// navigation-driven re-runs never cover.
	depends('app:mains');

	// The widening annotation states what the map cannot: a route param is any
	// string, so the join can miss.
	const exercise: Exercise | undefined = catalogById[params.id];

	if (exercise === undefined) {
		error(404, 'No such exercise');
	}

	const store = await getStore();

	// The family rows below the fold are catalog rows like any other, so they
	// carry the same last-session line — which is the whole point of linking
	// them: hints never cross entries, and the numbers are how you tell the
	// close-grip you actually train from the wide-grip you do not.
	//
	// `mains` is what seats the family: the sections below fold around the
	// account's chosen main, not the catalog's parent. The store rides along
	// for the one write this screen makes — that choice.
	const [past, lastPerformed, mains] = await Promise.all([
		store.pastSessions(exercise.id),
		store.lastPerformed(),
		store.mainVariants()
	]);

	return { store, exercise, past, lastPerformed, mains };
};
