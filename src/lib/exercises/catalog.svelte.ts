import { catalog } from '$lib/catalog';
import type { Catalog } from '$lib/domain/custom';
import { isCustomRecord, withCustoms } from '$lib/domain/custom';
import type { Store } from '$lib/store/store';
import type { WireRecord } from '$lib/sync/protocol';

class CatalogHolder {
	public current: Catalog = $state.raw(withCustoms(catalog, []));

	public async load(store: Store): Promise<Catalog> {
		this.current = await store.catalog();

		return this.current;
	}

	public async pulled(store: Store, records: WireRecord[]): Promise<void> {
		if (records.some((record) => isCustomRecord(record.id))) {
			await this.load(store);
		}
	}
}

export const exerciseCatalog = new CatalogHolder();
