import { goto, invalidate } from '$app/navigation';
import { firstUncompleted, repeatFrom } from '$lib/domain/workout';
import type { Workout } from '$lib/domain/workout';
import type { Store } from '$lib/store/store';
import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';

export async function repeatBlocked(store: Store): Promise<boolean> {
	return activeWorkout.session !== null || (await store.loadSnapshot()) !== null;
}

export async function launchRepeat(store: Store, workout: Workout): Promise<void> {
	activeWorkout.finish();

	const next = repeatFrom(workout, Date.now(), () => crypto.randomUUID());
	const first = firstUncompleted(next);

	await store.saveSnapshot({
		workout: next,
		activeSetId: first === null ? null : first.set.id,
		rest: null,
		muted: false
	});

	await invalidate(SESSION_DEP);

	// Straight into the session — its own load picks the snapshot up. One pushed entry, and
	// `‹` walks up to the Train home rather than retracing the launch.
	await goto('/train/live');
}
