import { catalogById } from '$lib/catalog';
import { historyKey, settleGrip } from '$lib/domain/grip';
import {
	addExercise as insertExercise,
	addSet as appendSet,
	advanceFrom,
	clearSet,
	commitSet,
	cursorFor,
	cursors,
	draftSet,
	firstUncompleted,
	insertedSetCount,
	markSet,
	moveEntry as relocateEntry,
	moveExercise as relocateExercise,
	rateSet,
	removeExercise as dropExercise,
	removeSet as dropSet,
	replaceExercise,
	setExerciseGrip as gripExercise,
	setSetArms as armSet,
	setSetGrip as gripSet,
	splitEntry,
	supersetWith
} from '$lib/domain/workout';
import type { Arms, History, Workout } from '$lib/domain/workout';
import type { LastGrips } from '$lib/store/derive';

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

	private readonly grips: LastGrips;

	public constructor(history: History, resume: Resume | null = null, grips: LastGrips = {}) {
		this.history = history;
		this.grips = grips;

		if (resume !== null) {
			this.workout = resume.workout;
			this.#focus(resume.activeSetId);
		}
	}

	/**
	 * The grip an exercise opens on here: the one it was last worked with, else the default.
	 *
	 * `undefined` for an exercise with no axis, which is most of them, and the sets it makes
	 * then carry no grip at all.
	 */
	#opening(catalogId: string): string | undefined {
		return settleGrip(catalogById[catalogId], this.grips[catalogId]);
	}

	#setCount(catalogId: string): number {
		const meta = catalogById[catalogId];

		return insertedSetCount(this.history, historyKey(catalogId, meta, this.#opening(catalogId)));
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

	// Moving the cursor is the whole of it. What the card offers is worked out where it is
	// shown, so a set the lifter passes through carries nothing away from the visit.
	#focus(setId: string | null): void {
		this.activeSetId = setId;
	}

	public draft(setId: string, weight: number | null, reps: number | null): void {
		draftSet(this.workout, setId, { weight, reps });
	}

	// Where the cursor stands is where lifting resumes, so a cleared set only takes it when
	// nothing else holds it — the session had ended, and clearing a logged set reopens it.
	public clear(setId: string): void {
		if (!clearSet(this.workout, setId)) {
			return;
		}

		if (this.activeSetId === null) {
			this.#focus(setId);
		}
	}

	public rate(setId: string, rpe: number | null): void {
		rateSet(this.workout, setId, rpe);
	}

	public commit(weight: number, reps: number): string | null {
		const id = this.activeSetId;

		if (id === null || !commitSet(this.workout, id, weight, reps)) {
			return null;
		}

		this.#focus(advanceFrom(this.workout, id)?.set.id ?? null);

		return id;
	}

	// One gesture logs a set exactly as offered, wherever it sits. The set under the cursor
	// commits and advances as a logged set always has; any other row keeps the cursor where
	// the lifter parked it — logging a set behind it is a correction, not a move.
	public quickLog(setId: string, weight: number, reps: number): boolean {
		if (setId === this.activeSetId) {
			return this.commit(weight, reps) !== null;
		}

		return commitSet(this.workout, setId, weight, reps);
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
			const count = this.#setCount(exerciseId);

			const entry = insertExercise(
				this.workout,
				exerciseId,
				{
					entry: crypto.randomUUID(),
					exercise: crypto.randomUUID(),
					sets: Array.from({ length: count }, () => crypto.randomUUID())
				},
				anchor,
				this.#opening(exerciseId)
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
			const count = this.#setCount(exerciseId);

			supersetWith(
				this.workout,
				entryId,
				exerciseId,
				{
					exercise: crypto.randomUUID(),
					sets: Array.from({ length: count }, () => crypto.randomUUID())
				},
				this.#opening(exerciseId)
			);
		}

		if (this.activeSetId === null) {
			this.#focus(firstUncompleted(this.workout)?.set.id ?? null);
		}
	}

	public breakSuperset(entryId: string): void {
		splitEntry(this.workout, entryId, () => crypto.randomUUID());
	}

	// Nothing to re-offer afterwards: the card works out what it shows where it is shown, so a
	// grip change reaches the fields on the next read.
	public setExerciseGrip(exerciseId: string, grip: string): void {
		const exercise = cursors(this.workout).find((c) => c.exercise.id === exerciseId)?.exercise;

		if (exercise === undefined) {
			return;
		}

		gripExercise(this.workout, exerciseId, catalogById[exercise.exerciseId], grip);
	}

	public setSetGrip(setId: string, grip: string): void {
		const cursor = cursorFor(this.workout, setId);

		if (cursor === null) {
			return;
		}

		gripSet(this.workout, setId, catalogById[cursor.exercise.exerciseId], grip);
	}

	public setSetArms(setId: string, arms: Arms): void {
		armSet(this.workout, setId, arms);
	}

	public swapExercise(exerciseId: string, catalogId: string): void {
		const active = this.activeSetId === null ? null : cursorFor(this.workout, this.activeSetId);
		const held = active === null || active.exercise.id === exerciseId;

		const count = this.#setCount(catalogId);

		const exercise = replaceExercise(
			this.workout,
			exerciseId,
			catalogId,
			{
				exercise: crypto.randomUUID(),
				sets: Array.from({ length: count }, () => crypto.randomUUID())
			},
			this.#opening(catalogId)
		);

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

		// `advanceFrom` only looks forward, and the removed exercise may have been the last
		// thing ahead — sets still owed behind the seam are why the wrap-around is owed too.
		const next =
			(above === null ? null : advanceFrom(this.workout, above)) ?? firstUncompleted(this.workout);

		this.#focus(next?.set.id ?? null);
	}

	public moveEntry(entryId: string, index: number): void {
		relocateEntry(this.workout, entryId, index);
	}

	public moveExercise(exerciseId: string): void {
		relocateExercise(this.workout, exerciseId, -1);
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

		// Same wrap as removing an exercise: forward first, then anything still owed behind.
		const next =
			(above === null ? null : advanceFrom(this.workout, above)) ?? firstUncompleted(this.workout);

		this.#focus(next?.set.id ?? null);
	}
}
