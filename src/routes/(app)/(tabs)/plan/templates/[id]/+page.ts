import { blankTemplate } from '$lib/domain/template';
import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const store = await getStore();
	const [stored, { lastPerformed, heaviest, frequent }, planRest] = await Promise.all([
		store.getTemplate(params.id),
		store.pickerData(),
		store.planRest(params.id)
	]);

	return {
		store,
		template: stored ?? blankTemplate(params.id, Date.now()),
		persisted: stored !== null,
		planRest,
		lastPerformed,
		heaviest,
		frequent
	};
};
