import { restTimer } from '$lib/workout/rest.svelte';
import { WorkoutSession } from '$lib/workout/session.svelte';

import type { History } from '$lib/domain/workout';
import type { LastGrips } from '$lib/store/derive';
import type { Resume } from '$lib/workout/session.svelte';

export const SESSION_DEP = 'kilorep:active-workout';

class ActiveWorkout {
	public session: WorkoutSession | null = $state(null);

	public begin(
		history: History,
		resume: Resume | null = null,
		grips: LastGrips = {}
	): WorkoutSession {
		restTimer.reset();

		this.session = new WorkoutSession(history, resume, grips);

		return this.session;
	}

	public finish(): void {
		this.session = null;
		restTimer.reset();
	}
}

export const activeWorkout = new ActiveWorkout();
