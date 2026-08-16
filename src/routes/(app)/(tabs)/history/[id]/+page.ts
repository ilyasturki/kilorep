import { error } from '@sveltejs/kit';

import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const store = await getStore();
	const workout = await store.getWorkout(params.id);

	if (workout === null) {
		error(404, 'No such workout');
	}

	// `??`, not `=== null`: records written before `templateId` existed lack the
	// key, and `undefined` reaches `getTemplate` as a DataError-throwing key.
	const templateId = workout.templateId ?? null;

	const [template, { lastPerformed, frequent }] = await Promise.all([
		templateId === null ? null : store.getTemplate(templateId),
		store.pickerData()
	]);

	return { store, workout, template, lastPerformed, frequent };
};
