import { error } from '@sveltejs/kit';

import { catalogById } from '$lib/catalog';
import type { Exercise } from '$lib/domain/exercise';
import { isArchived } from '$lib/domain/template';
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

	// The family rows below the fold are catalog rows like any other, so they
	// carry the same last-session line — which is the whole point of linking
	// them: hints never cross entries, and the numbers are how you tell the
	// close-grip you actually train from the wide-grip you do not.
	const [past, lastPerformed] = await Promise.all([
		store.pastSessions(exercise.id),
		store.lastPerformed()
	]);

	// Only the never-trained screen offers to plan this exercise, so only it
	// pays for the read — and it asks after `past`, not beside it, because the
	// answer is what decides whether the question is worth asking. Archived
	// plans are dropped here: a plan you have put away is not one you are
	// adding to, and the page needs the active count to know whether it can
	// offer the act at all.
	const templates = past.length === 0 ? await store.listTemplates() : [];
	const plans = templates.filter((plan) => !isArchived(plan));

	return { exercise, past, lastPerformed, plans };
};
