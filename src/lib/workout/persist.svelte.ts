import { untrack } from 'svelte';

import type { Store } from '$lib/store/store';
import { restTimer } from '$lib/workout/rest.svelte';
import type { WorkoutSession } from '$lib/workout/session.svelte';

/**
 * Write the live session to disk, or clear what is on it.
 *
 * The workout screen calls this from an effect and gets exactly what that
 * effect used to do inline: `$state.snapshot` reads every leaf of the tree
 * here, inside the caller's frame, so the effect still re-runs on any mutation
 * — a committed set, a reorder, a removal. Fire-and-forget; the screen never
 * waits on IndexedDB, per the loop rule.
 *
 * It is a function rather than that inline block because the workout screen
 * stopped being the only place a session is mutated. The exercise detail page
 * adds an exercise to a running workout, and the effect that would have saved
 * it is on a screen that is not mounted — so a reload between the tap and the
 * walk back would have dropped the exercise on the floor. One writer, called
 * by both, is the only version of this that cannot drift.
 *
 * A session that holds nothing is not saved — cleared, even: "in progress" is
 * a claim the bars and the boot resume repeat, and an empty tree left by a tap
 * on Start-empty and a change of mind should not survive a reload to make it.
 * The clear also retires any such snapshot written before this rule existed.
 *
 * The rest fields ride along untracked, and that is not an optimisation: the
 * timer writes its own changes through `store.saveRest`, because the bar
 * answers a thumb from every tab and the workout screen's effect only runs
 * while that screen is mounted. Tracking them there would make every ±30s
 * write the whole tree a second time. Read rather than omitted because
 * `saveSnapshot` writes the record whole — leaving them out would erase a
 * running rest on the next logged set.
 */
export function persistSession(store: Store, session: WorkoutSession): void {
	const workout = $state.snapshot(session.workout);

	if (workout.entries.length === 0) {
		void store.clearSnapshot();

		return;
	}

	void store.saveSnapshot({
		workout,
		activeSetId: session.activeSetId,
		...untrack(() => ({ rest: restTimer.snapshot, muted: restTimer.muted }))
	});
}
