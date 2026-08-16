import { defaultRestSettings, settleRestSeconds } from '$lib/domain/rest';
import type { RestSettings } from '$lib/domain/rest';
import type { RestDefaultPreference } from '$lib/domain/preference';
import type { Store } from '$lib/store/store';

class RestSettingsHolder {
	public current: RestSettings = $state(defaultRestSettings());

	public async load(store: Store): Promise<void> {
		this.current = await store.restSettings();
	}

	public async setDefault(store: Store, patch: Partial<RestDefaultPreference>): Promise<void> {
		const enabled = patch.enabled ?? this.current.enabled;
		const seconds = settleRestSeconds(patch.seconds ?? this.current.seconds);

		this.current = { ...this.current, enabled, seconds };

		await store.setRestDefault({ enabled, seconds }, Date.now());
	}

	public overrideFor(exerciseId: string): number | null | undefined {
		return this.current.overrides[exerciseId];
	}

	public async setOverride(
		store: Store,
		exerciseId: string,
		seconds: number | null
	): Promise<void> {
		const settled = seconds === null ? null : settleRestSeconds(seconds);

		this.current = {
			...this.current,
			overrides: { ...this.current.overrides, [exerciseId]: settled }
		};

		await store.setRestOverride(exerciseId, settled, Date.now());
	}

	// The key leaves the map rather than being set: an absent override falls back
	// to the default, while a stored `null` means never rest.
	public async clearOverride(store: Store, exerciseId: string): Promise<void> {
		const { [exerciseId]: _dropped, ...rest } = this.current.overrides;

		this.current = { ...this.current, overrides: rest };

		await store.clearRestOverride(exerciseId, Date.now());
	}
}

export const restSettings = new RestSettingsHolder();
