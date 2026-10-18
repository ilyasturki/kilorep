import { error } from '@sveltejs/kit';

import { blankTemplate } from '$lib/domain/template';
import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const store = await getStore();
	const [stored, deleted, { lastPerformed, heaviest, frequent }, planRest, latest, answered] =
		await Promise.all([
			store.getTemplate(params.id),
			store.templateDeleted(params.id),
			store.pickerData(),
			store.planRest(params.id),
			store.latestWorkout(params.id),
			store.answeredOffer(params.id)
		]);

	if (deleted) {
		error(404, 'This template was deleted');
	}

	return {
		store,
		template: stored ?? blankTemplate(params.id, Date.now()),
		persisted: stored !== null,
		planRest,
		lastPerformed,
		heaviest,
		frequent,
		offered: latest === null || answered === latest.id ? null : latest
	};
};
