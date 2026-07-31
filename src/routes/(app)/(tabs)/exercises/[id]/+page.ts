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
export const load: PageLoad = async ({ params }) => {
	// The widening annotation states what the map cannot: a route param is any
	// string, so the join can miss.
	const exercise: Exercise | undefined = catalogById[params.id];

	if (exercise === undefined) {
		error(404, 'No such exercise');
	}

	const store = await getStore();

	return { exercise, past: await store.pastSessions(exercise.id) };
};
