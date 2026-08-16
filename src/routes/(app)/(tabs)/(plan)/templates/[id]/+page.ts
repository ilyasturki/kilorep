import { blankTemplate } from '$lib/domain/template';
import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	const store = await getStore();
	const [stored, { lastPerformed, frequent }] = await Promise.all([
		store.getTemplate(params.id),
		store.pickerData()
	]);

	return {
		store,
		template: stored ?? blankTemplate(params.id, Date.now()),
		persisted: stored !== null,
		lastPerformed,
		frequent
	};
};
