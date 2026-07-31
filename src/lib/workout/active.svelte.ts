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
