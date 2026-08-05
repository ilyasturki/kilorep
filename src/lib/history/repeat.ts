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

	// The mute is a property of the session that just ended, not of this one.
	await store.saveSnapshot({
		workout: next,
		activeSetId: first === null ? null : first.set.id,
		rest: null,
		muted: false
	});

	// The holder just changed, so the workout loads' cached answers are stale —
	// including any the hover-preloader took while a session was still live.
	// `active.svelte.ts` has the whole story.
	await invalidate(SESSION_DEP);

	// `/workout` is where a handoff is claimed, and the invalidate above has
	// already claimed it when that is the screen we are standing on: its load
	// depends on `SESSION_DEP`, so the re-run finds the snapshot and redirects
	// into the loop from inside the invalidation. Going there again would push
	// an entry that same redirect immediately replaces, leaving two identical
	// `/workout/live` entries and a back press that appears to do nothing.
	//
	// `location` rather than `page.url`, because this is not a component and the
	// app never renders on a server — `ssr = false` is a hard rule, not a
	// setting.
	if (location.pathname !== '/workout') {
		await goto('/workout');
	}
}
