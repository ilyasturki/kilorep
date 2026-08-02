import { WorkoutSession } from '$lib/workout/session.svelte';

import type { History } from '$lib/domain/workout';
import type { Resume } from '$lib/workout/session.svelte';

/**
 * The one live session, or null while nothing is being logged.
 *
 * It exists because the workout page is no longer the session's only reader:
 * both nav bars badge the Workout tab with the live dot, the tab bar stands
 * down while one runs, and the workout screen's posture is this field. A
 * session constructed inside the page died with the page — walking to
 * Exercises mid-workout threw the whole workout away, silently.
 *
 * A property on a stable instance rather than a reassigned `$state` export,
 * because the compiler transforms state references file by file and cannot
 * follow a reassignment across a module boundary — mutating a field of an
 * export that never moves is the shape it can track.
 *
 * Begun by an explicit start — the workout screen's button, the template
 * editor's handoff — or by the `(app)` layout's cold-start resume, and ended
 * by FINISH. The holder itself is memory only; the snapshot in the store is
 * what survives a reload, and the boot resume refilling this from it is what
 * keeps every reader honest from the first frame.
 *
 * Its own file rather than the foot of `session.svelte.ts`, because the holder
 * and the session it holds are two classes and one file may declare one. The
 * split falls where the dependency already pointed: this imports the session,
 * the session knows nothing of the holder.
 */
/**
 * The name the two workout loads register against this holder, and the one
 * anything that fills or empties it invalidates.
 *
 * They guard on `session` below, which is module state SvelteKit cannot see —
 * so without a declared dependency it is free to cache what a load decided, and
 * it does. `app.html` preloads on hover, so passing the mouse over the Workout
 * tab on the way to FINISH runs `/workout`'s load while the session is still
 * live, caches the redirect it produces, and hands that same redirect back to
 * the `goto` that FINISH makes a moment later — landing back in a workout that
 * had just ended. Declared, the entry is stale the moment this holder changes.
 *
 * A string constant rather than each side spelling its own: two loads and four
 * call sites have to agree on it, and a typo would silently reinstate the bug.
 */
export const SESSION_DEP = 'kilorep:active-workout';

class ActiveWorkout {
	public session: WorkoutSession | null = $state(null);

	public begin(history: History, resume: Resume | null = null): WorkoutSession {
		this.session = new WorkoutSession(history, resume);

		return this.session;
	}

	public finish(): void {
		this.session = null;
	}
}

export const activeWorkout = new ActiveWorkout();
