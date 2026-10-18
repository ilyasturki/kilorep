import { error } from '@sveltejs/kit';

import { getStore } from '$lib/store/store';
import { offerStands } from '$lib/templates/offer';

import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const store = await getStore();
	const workout = await store.getWorkout(params.id);

	if (workout === null) {
		error(404, 'No such workout');
	}

	// Every plan, not the one it names: the link is editable here, and the plan it moves to
	// has to be in the sheet before it can be picked.
	const plan = workout.templateId ?? null;

	const [templates, { lastPerformed, heaviest, frequent }, newest, answered, planWrittenAt] =
		await Promise.all([
			store.listTemplates(),
			store.pickerData(),
			store.latestWorkout(plan ?? undefined),
			store.answeredOffer(plan),
			plan === null ? null : store.templateWrittenAt(plan)
		]);

	const offer = {
		templateId: plan,
		open: offerStands(workout, {
			newest: newest === null ? null : newest.id,
			answered,
			planWrittenAt
		})
	};

	return { store, workout, templates, lastPerformed, heaviest, frequent, offer };
};
