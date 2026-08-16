import { untrack } from 'svelte';

import type { Store } from '$lib/store/store';
import { restTimer } from '$lib/workout/rest.svelte';
import type { WorkoutSession } from '$lib/workout/session.svelte';

export function persistSession(store: Store, session: WorkoutSession): void {
	const workout = $state.snapshot(session.workout);

	if (workout.entries.length === 0) {
		void store.clearSnapshot();

		return;
	}

	void store.saveSnapshot({
		workout,
		activeSetId: session.activeSetId,
		// `saveSnapshot` writes the record whole: omitting rest would erase it.
		...untrack(() => ({ rest: restTimer.snapshot, muted: restTimer.muted }))
	});
}
