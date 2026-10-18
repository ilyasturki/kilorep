import { retime } from '$lib/domain/retime';
import { canCommit, cursorFor, draftSet, markSet, settle } from '$lib/domain/workout';
import type { FinishedWorkout } from '$lib/store/derive';
import type { Store } from '$lib/store/store';
import { WorkoutSession } from '$lib/workout/session.svelte';

export type Figure = 'weight' | 'reps';

function settledFigure(which: Figure, value: number): number {
	return which === 'reps' ? Math.max(0, Math.round(value)) : settle(value);
}

/**
 * A finished workout being corrected: every edit lands in a copy, and only `save` writes it.
 *
 * The structural edits — sets, exercises, supersets, grips — are the live session's own, run
 * over the copy through a `WorkoutSession` holding the same proxy.
 */
export class RecordEditor {
	public draft: FinishedWorkout;

	public readonly session: WorkoutSession;

	readonly #original: string;

	public readonly dirty: boolean;

	public constructor(record: FinishedWorkout) {
		const copy = structuredClone(record);

		this.#original = JSON.stringify(copy);
		this.draft = $state(copy);
		this.dirty = $derived(JSON.stringify(this.draft) !== this.#original);
		// No history: the record predates every hint it could read.
		this.session = new WorkoutSession({}, { workout: this.draft, activeSetId: null });
	}

	// A set holding both numbers is one that happened: typing them into the record says so, and
	// clearing either takes the set back out of the count.
	public figure(setId: string, which: Figure, value: number | null): void {
		const set = cursorFor(this.draft, setId)?.set;

		if (set === undefined) {
			return;
		}

		const settled = value === null ? null : settledFigure(which, value);

		if (set[which] === settled) {
			return;
		}

		const values = { weight: set.weight, reps: set.reps, [which]: settled };

		draftSet(this.draft, setId, values);

		if (canCommit(values.weight, values.reps)) {
			markSet(this.draft, setId, true);
		}
	}

	public log(setId: string): void {
		markSet(this.draft, setId, true);
	}

	public unlog(setId: string): void {
		markSet(this.draft, setId, false);
	}

	public moveTo(date: string): void {
		const span = retime(this.draft, { date });

		this.draft.startedAt = span.startedAt;
		this.draft.finishedAt = span.finishedAt;
	}

	public record(): FinishedWorkout {
		return $state.snapshot(this.draft);
	}

	/** Whether anything was written: an untouched draft saves as nothing at all. */
	public async save(store: Pick<Store, 'updateWorkout'>, at: number): Promise<boolean> {
		if (!this.dirty) {
			return false;
		}

		await store.updateWorkout(this.record(), at);

		return true;
	}
}
