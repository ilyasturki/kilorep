import {
	addExercise as insertExercise,
	addSet as appendSet,
	advanceFrom,
	commitSet,
	cursorFor,
	cursors,
	draftSet,
	firstUncompleted,
	insertedSetCount,
	markSet,
	moveEntry as relocateEntry,
	prefillFor,
	rateSet,
	removeExercise as dropExercise,
	removeSet as dropSet,
	replaceExercise,
	splitEntry,
	supersetWith
} from '$lib/domain/workout';
import type { History, Workout } from '$lib/domain/workout';

export type Resume = {
	workout: Workout;
	activeSetId: string | null;
};

const emptyWorkout = (): Workout => ({
	id: crypto.randomUUID(),
	templateId: null,
	startedAt: Date.now(),
	entries: []
});

export class WorkoutSession {
	public workout: Workout = $state(emptyWorkout());

	public activeSetId: string | null = $state(null);

	private readonly history: History;

	readonly #cleared = new Set<string>();

	public constructor(history: History, resume: Resume | null = null) {
		this.history = history;

		if (resume !== null) {
			this.workout = resume.workout;
			this.#focus(resume.activeSetId);
		}
	}

	public get finished(): boolean {
		return this.activeSetId === null;
	}

	public get hasLoggedSets(): boolean {
		return cursors(this.workout).some((c) => c.set.completed);
	}

	public select(setId: string): void {
		this.#focus(setId);
	}

	#focus(setId: string | null): void {
		this.activeSetId = setId;

		if (setId === null || this.#cleared.has(setId)) {
			return;
		}

		const cursor = cursorFor(this.workout, setId);

		if (cursor === null) {
			return;
		}

		draftSet(this.workout, setId, prefillFor(cursor, this.history));
	}

	public draft(setId: string, weight: number | null, reps: number | null): void {
		const cursor = cursorFor(this.workout, setId);

		if (
			cursor !== null &&
			((weight === null && cursor.set.weight !== null) ||
				(reps === null && cursor.set.reps !== null))
		) {
			this.#cleared.add(setId);
		}

		draftSet(this.workout, setId, { weight, reps });
	}

	public rate(setId: string, rpe: number | null): void {
		rateSet(this.workout, setId, rpe);
	}

	public commit(weight: number, reps: number): void {
		const id = this.activeSetId;

		if (id === null || !commitSet(this.workout, id, weight, reps)) {
			return;
		}

		this.#focus(advanceFrom(this.workout, id)?.set.id ?? null);
	}

	public unlogSet(setId: string): void {
		if (!markSet(this.workout, setId, false)) {
			return;
		}

		this.#focus(setId);
	}

	public addSet(exerciseId: string): void {
		const set = appendSet(this.workout, exerciseId, crypto.randomUUID());

		if (set !== null) {
			this.#focus(set.id);
		}
	}

	public addExercises(exerciseIds: string[], after?: string): void {
		let first: string | null = null;
		let anchor = after;

		for (const exerciseId of exerciseIds) {
			const count = insertedSetCount(this.history, exerciseId);

			const entry = insertExercise(
				this.workout,
				exerciseId,
				{
					entry: crypto.randomUUID(),
					exercise: crypto.randomUUID(),
					sets: Array.from({ length: count }, () => crypto.randomUUID())
				},
				anchor
			);

			if (entry === null) {
				continue;
			}

			anchor = anchor === undefined ? undefined : entry.id;
			first ??= entry.exercises[0].sets[0].id;
		}

		if (first !== null) {
			this.#focus(first);
		}
	}

	public superset(entryId: string, exerciseIds: string[]): void {
		for (const exerciseId of exerciseIds) {
			const count = insertedSetCount(this.history, exerciseId);

			supersetWith(this.workout, entryId, exerciseId, {
				exercise: crypto.randomUUID(),
				sets: Array.from({ length: count }, () => crypto.randomUUID())
			});
		}

		if (this.activeSetId === null) {
			this.#focus(firstUncompleted(this.workout)?.set.id ?? null);
		}
	}

	public breakSuperset(entryId: string): void {
		splitEntry(this.workout, entryId, () => crypto.randomUUID());
	}

	public swapExercise(exerciseId: string, catalogId: string): void {
		const active = this.activeSetId === null ? null : cursorFor(this.workout, this.activeSetId);
		const held = active === null || active.exercise.id === exerciseId;

		const count = insertedSetCount(this.history, catalogId);

		const exercise = replaceExercise(this.workout, exerciseId, catalogId, {
			exercise: crypto.randomUUID(),
			sets: Array.from({ length: count }, () => crypto.randomUUID())
		});

		if (exercise !== null && held) {
			this.#focus(exercise.sets[0].id);
		}
	}

	public removeExercise(exerciseId: string): void {
		const all = cursors(this.workout);
		const at = all.findIndex((c) => c.exercise.id === exerciseId);
		const above = at > 0 ? all[at - 1].set.id : null;
		const held = all.some((c) => c.exercise.id === exerciseId && c.set.id === this.activeSetId);

		if (!dropExercise(this.workout, exerciseId) || !held) {
			return;
		}

		const next = above === null ? firstUncompleted(this.workout) : advanceFrom(this.workout, above);

		this.#focus(next?.set.id ?? null);
	}

	public moveEntry(entryId: string, index: number): void {
		relocateEntry(this.workout, entryId, index);
	}

	public removeSet(setId: string): void {
		const all = cursors(this.workout);
		const at = all.findIndex((c) => c.set.id === setId);
		const above = at > 0 ? all[at - 1].set.id : null;

		if (!dropSet(this.workout, setId)) {
			return;
		}

		if (this.activeSetId !== setId) {
			return;
		}

		const next = above === null ? firstUncompleted(this.workout) : advanceFrom(this.workout, above);

		this.#focus(next?.set.id ?? null);
	}
}
