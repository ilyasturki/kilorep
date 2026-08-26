import { error } from '@sveltejs/kit';

import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const store = await getStore();
	const workout = await store.getWorkout(params.id);

	if (workout === null) {
		error(404, 'No such workout');
	}

	// Every plan, not the one it names: the link is editable here, and the plan it moves to
	// has to be in the sheet before it can be picked.
	const [templates, { lastPerformed, heaviest, frequent }] = await Promise.all([
		store.listTemplates(),
		store.pickerData()
	]);

	return { store, workout, templates, lastPerformed, heaviest, frequent };
};
