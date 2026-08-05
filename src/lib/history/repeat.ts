import { goto, invalidate } from '$app/navigation';
import { firstUncompleted, repeatFrom } from '$lib/domain/workout';
import type { Workout } from '$lib/domain/workout';
import type { Store } from '$lib/store/store';
import { activeWorkout, SESSION_DEP } from '$lib/workout/active.svelte';

/**
 * Repeat-as-resume, in one place because it now has two front doors: the ⋯ on
 * a workout's own page, and the hold on its row in the list.
 *
 * The gate is the reason this is shared rather than copied. Exactly one workout
 * is active at a time, and a live session — or a snapshot waiting out a reload
 * — may hold logged sets that starting over would destroy. A second copy of
 * that check is a second chance to get it wrong, and the thing it protects is
 * somebody's session.
 */
export async function repeatBlocked(store: Store): Promise<boolean> {
	return activeWorkout.session !== null || (await store.loadSnapshot()) !== null;
}

export async function launchRepeat(store: Store, workout: Workout): Promise<void> {
	activeWorkout.finish();

	const next = repeatFrom(workout, Date.now(), () => crypto.randomUUID());
	const first = firstUncompleted(next);

	await store.saveSnapshot({
		workout: next,
		activeSetId: first === null ? null : first.set.id
	});

	// The holder just changed, so the workout loads' cached answers are stale —
	// including any the hover-preloader took while a session was still live.
	// `active.svelte.ts` has the whole story.
	await invalidate(SESSION_DEP);
	await goto('/workout');
}
