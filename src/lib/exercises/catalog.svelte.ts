import { catalog } from '$lib/catalog';
import type { Catalog, CustomDraft } from '$lib/domain/custom';
import { isCustomRecord, newCustomId, withCustoms } from '$lib/domain/custom';
import type { Exercise } from '$lib/domain/exercise';
import type { Store } from '$lib/store/store';
import { getStore } from '$lib/store/store';
import { syncSoon } from '$lib/sync/client';
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

	async #wrote(store: Store, account: string | null): Promise<void> {
		await this.load(store);

		if (account !== null) {
			syncSoon(account);
		}
	}

	public async create(draft: CustomDraft, account: string | null): Promise<Exercise> {
		const store = await getStore();
		const id = newCustomId();

		await store.saveCustomExercise(id, draft, Date.now());
		await this.#wrote(store, account);

		return this.current.byId[id];
	}

	public async edit(id: string, draft: CustomDraft, account: string | null): Promise<void> {
		const store = await getStore();

		await store.saveCustomExercise(id, draft, Date.now());
		await this.#wrote(store, account);
	}

	/** Archived while anything names it, so history keeps its name; gone otherwise. */
	public async remove(id: string, account: string | null): Promise<'archived' | 'deleted'> {
		const store = await getStore();
		const now = Date.now();
		const named = await store.exerciseInUse(id);

		await (named ? store.archiveCustomExercise(id, now, now) : store.deleteCustomExercise(id, now));
		await this.#wrote(store, account);

		return named ? 'archived' : 'deleted';
	}

	public async restore(id: string, account: string | null): Promise<void> {
		const store = await getStore();

		await store.archiveCustomExercise(id, null, Date.now());
		await this.#wrote(store, account);
	}

	public async addGrip(exerciseId: string, label: string, account: string | null): Promise<string> {
		const store = await getStore();
		const id = newCustomId();
		const now = Date.now();

		await store.saveCustomGrip(id, { exerciseId, label, createdAt: now }, now);
		await this.#wrote(store, account);

		return id;
	}

	public async renameGrip(gripId: string, label: string, account: string | null): Promise<void> {
		const store = await getStore();

		await store.renameCustomGrip(gripId, label, Date.now());
		await this.#wrote(store, account);
	}

	public async removeGrip(gripId: string, account: string | null): Promise<void> {
		const store = await getStore();

		await store.deleteCustomGrip(gripId, Date.now());
		await this.#wrote(store, account);
	}
}

export const exerciseCatalog = new CatalogHolder();
