import { getStore } from '$lib/store/store';
import { RECORDS_DEP } from '$lib/sync/client';

import type { PageLoad } from './$types';

export const load: PageLoad = async ({ depends }) => {
	depends(RECORDS_DEP);

	const store = await getStore();

	return store.ledgerData();
};
