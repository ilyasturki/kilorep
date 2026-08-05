import { defaultRestSettings, settleRestSeconds } from '$lib/domain/rest';
import type { RestSettings } from '$lib/domain/rest';
import type { RestDefaultPreference } from '$lib/domain/preference';
import type { Store } from '$lib/store/store';

/**
 * The user's standing rest taste, held where every reader can see it.
 *
 * Replaced wholesale on every write rather than mutated in place: it is read as
 * one value by `restAfter`, and a half-updated object crossing that call is a
 * rest of the wrong length.
 */
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

	/**
	 * Back to no opinion, which is not the same as never-rest. The key leaves the
	 * map rather than being set to undefined, so `restSecondsFor` sees an absence
	 * and falls to the default.
	 */
	public async clearOverride(store: Store, exerciseId: string): Promise<void> {
		const { [exerciseId]: _dropped, ...rest } = this.current.overrides;

		this.current = { ...this.current, overrides: rest };

		await store.clearRestOverride(exerciseId, Date.now());
	}
}

export const restSettings = new RestSettingsHolder();
