import { blankTemplate } from '$lib/domain/template';
import { getStore } from '$lib/store/store';

import type { PageLoad } from './$types';

/**
 * The template behind the id, or a blank one wearing it: the route param *is*
 * the template id — "New template" mints a uuid and navigates, and the editor
 * this loads decides whether a record ever comes of it. An unknown id is
 * therefore not a 404, it is the new-template state; a mistyped deep link
 * lands in an empty editor that will write nothing unless edited, which is
 * the cheapest honest answer this screen can give.
 *
 * The store rides along because the page keeps writing to it — every edit
 * persists, and Start hands the built workout over as a snapshot.
 *
 * The picker's two reads are the sheet's, not the editor's: adding an exercise
 * to a plan is the same choice the workout screen's insert makes, and the rows
 * and the shelf above them answer it the same way.
 */
export const load: PageLoad = async ({ params }) => {
	const store = await getStore();
	const [stored, { lastPerformed, frequent, mains }] = await Promise.all([
		store.getTemplate(params.id),
		store.pickerData()
	]);

	return {
		store,
		template: stored ?? blankTemplate(params.id, Date.now()),
		persisted: stored !== null,
		lastPerformed,
		frequent,
		mains
	};
};
