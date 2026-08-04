import type { ExertionScale } from '$lib/domain/exertion';
import type { Store } from '$lib/store/store';

/**
 * Which name a rating wears on this account, held where every screen can read
 * it synchronously.
 *
 * A holder rather than page data, because the readers are scattered and none of
 * them owns the fact: the picker on the live card, the pill on a logged row,
 * the recall line, the history editor and the settings row that changes it.
 * Threading it through four `load` functions would mean four places to forget,
 * and a screen that forgot would render the wrong word rather than fail.
 *
 * A property on a stable instance rather than a reassigned `$state` export, for
 * the reason `activeWorkout` gives at length: the compiler transforms state
 * references file by file and cannot follow a reassignment across a module
 * boundary.
 *
 * The store is the truth and this is the copy the frame reads. `load` fills it
 * at boot, `choose` writes both ends at once — the record first is not worth it,
 * because the screen must not wait on IndexedDB to relabel a chip, and a failed
 * write leaves a preference disagreeing with a record that nothing else reads
 * until the next boot puts them back in step.
 */
class ExertionScaleHolder {
	/**
	 * RPE until the store says otherwise — the default for an account that has
	 * never chosen, and the value the first frame renders while the boot read is
	 * still in flight.
	 */
	public current: ExertionScale = $state('rpe');

	public async load(store: Store): Promise<void> {
		this.current = await store.exertionScale();
	}

	public async choose(store: Store, scale: ExertionScale): Promise<void> {
		this.current = scale;

		await store.setExertionScale(scale, Date.now());
	}
}

export const exertionScale = new ExertionScaleHolder();
