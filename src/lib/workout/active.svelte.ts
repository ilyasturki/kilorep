import { restTimer } from '$lib/workout/rest.svelte';
import { WorkoutSession } from '$lib/workout/session.svelte';

import type { History } from '$lib/domain/workout';
import type { Resume } from '$lib/workout/session.svelte';

export const SESSION_DEP = 'kilorep:active-workout';

class ActiveWorkout {
	public session: WorkoutSession | null = $state(null);

	/**
	 * The timer is emptied first and refilled by the caller where there is
	 * something to refill it with — the cold-start resume in `(app)/+layout.ts`
	 * is the one path that has a rest to carry over.
	 */
	public begin(history: History, resume: Resume | null = null): WorkoutSession {
		restTimer.reset();

		this.session = new WorkoutSession(history, resume);

		return this.session;
	}

	/**
	 * The session ends, and the rest ends with it — including the session mute,
	 * which is what makes "for the remainder of this session" true rather than
	 * a setting nobody remembers turning on.
	 */
	public finish(): void {
		this.session = null;
		restTimer.reset();
	}
}

export const activeWorkout = new ActiveWorkout();
