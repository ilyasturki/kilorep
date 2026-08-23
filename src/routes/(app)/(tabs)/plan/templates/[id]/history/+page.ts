import { error } from '@sveltejs/kit';

import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const store = await getStore();

	const [template, workouts] = await Promise.all([
		store.getTemplate(params.id),
		store.listWorkouts()
	]);

	if (template === null) {
		error(404, 'No such template');
	}

	// `??`, not `=== null`: records written before `templateId` existed lack the key.
	return {
		template,
		workouts: workouts.filter((workout) => (workout.templateId ?? null) === params.id)
	};
};
