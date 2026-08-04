import type { ExertionScale } from '$lib/domain/exertion';
import type { Store } from '$lib/store/store';

class ExertionScaleHolder {
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
