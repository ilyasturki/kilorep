export type ExerciseIds = { exercise: string; sets: string[] };

export type NewExerciseIds = ExerciseIds & { entry: string };

type Entry<E> = { id: string; exercises: E[] };
type Tree<E> = { entries: Entry<E>[] };

export function exerciseIn<E extends { id: string }>(tree: Tree<E>, exerciseId: string): E | null {
	return tree.entries.flatMap((entry) => entry.exercises).find((e) => e.id === exerciseId) ?? null;
}

export function addExerciseTo<E extends { id: string }>(
	tree: Tree<E>,
	entryId: string,
	ids: ExerciseIds,
	make: (ids: ExerciseIds) => E
): E | null {
	const entry = tree.entries.find((e) => e.id === entryId);

	if (entry === undefined || ids.sets.length === 0) {
		return null;
	}

	const exercise = make(ids);

	entry.exercises.push(exercise);

	return exercise;
}

export function joinEntry<E extends { id: string }>(
	tree: Tree<E>,
	entryId: string,
	exerciseId: string
): boolean {
	const target = tree.entries.find((e) => e.id === entryId);

	if (target === undefined) {
		return false;
	}

	for (const [at, entry] of tree.entries.entries()) {
		const index = entry.exercises.findIndex((e) => e.id === exerciseId);

		if (index === -1) {
			continue;
		}

		if (entry === target) {
			return false;
		}

		const [exercise] = entry.exercises.splice(index, 1);

		target.exercises.push(exercise);

		if (entry.exercises.length === 0) {
			tree.entries.splice(at, 1);
		}

		return true;
	}

	return false;
}

export function supersetWith<E extends { id: string; exerciseId: string }>(
	tree: Tree<E>,
	entryId: string,
	catalogId: string,
	ids: ExerciseIds,
	make: (ids: ExerciseIds) => E
): boolean {
	const standing = tree.entries
		.filter((entry) => entry.id !== entryId)
		.flatMap((entry) => entry.exercises)
		.find((exercise) => exercise.exerciseId === catalogId);

	if (standing !== undefined) {
		return joinEntry(tree, entryId, standing.id);
	}

	return addExerciseTo(tree, entryId, ids, make) !== null;
}

export function splitEntry<E>(tree: Tree<E>, entryId: string, mint: () => string): boolean {
	const at = tree.entries.findIndex((e) => e.id === entryId);

	if (at === -1 || tree.entries[at].exercises.length < 2) {
		return false;
	}

	const entry = tree.entries[at];
	const [first, ...rest] = entry.exercises;

	entry.exercises = [first];

	tree.entries.splice(
		at + 1,
		0,
		...rest.map((exercise) => ({ id: mint(), exercises: [exercise] }))
	);

	return true;
}

export function removeExercise<E extends { id: string }>(
	tree: Tree<E>,
	exerciseId: string
): boolean {
	for (const [at, entry] of tree.entries.entries()) {
		const index = entry.exercises.findIndex((e) => e.id === exerciseId);

		if (index === -1) {
			continue;
		}

		entry.exercises.splice(index, 1);

		if (entry.exercises.length === 0) {
			tree.entries.splice(at, 1);
		}

		return true;
	}

	return false;
}

export function removeSet(tree: Tree<{ sets: { id: string }[] }>, setId: string): boolean {
	for (const entry of tree.entries) {
		for (const exercise of entry.exercises) {
			const at = exercise.sets.findIndex((s) => s.id === setId);

			if (at === -1) {
				continue;
			}

			if (exercise.sets.length === 1) {
				return false;
			}

			exercise.sets.splice(at, 1);

			return true;
		}
	}

	return false;
}

/**
 * Trade a leg with the one beside it, inside its own entry.
 *
 * The reorder a superset needs and the only one it needs: which exercise is
 * done first. `moveEntry` moves whole entries past each other and has nothing
 * to say about the order *within* one, so a planned pair was fixed in the order
 * it happened to be built in.
 *
 * Adjacent-swap rather than move-to-index, because that is what the divider
 * between two legs can honestly offer — it sits between exactly two of them.
 * A giant set reorders by composing swaps, which is the same bargain a list
 * with up-and-down arrows makes and needs no drag to keep honest.
 *
 * `towards` is the neighbour's direction, so `-1` on the first leg and `+1` on
 * the last are refused rather than wrapping: a swap that carried the top leg to
 * the bottom would be a move nobody asked a two-item control for.
 */
export function moveExercise<E extends { id: string }>(
	tree: Tree<E>,
	exerciseId: string,
	towards: -1 | 1
): boolean {
	for (const entry of tree.entries) {
		const at = entry.exercises.findIndex((e) => e.id === exerciseId);

		if (at === -1) {
			continue;
		}

		const to = at + towards;

		if (to < 0 || to >= entry.exercises.length) {
			return false;
		}

		[entry.exercises[at], entry.exercises[to]] = [entry.exercises[to], entry.exercises[at]];

		return true;
	}

	return false;
}

export function moveEntry<E>(tree: Tree<E>, entryId: string, toIndex: number): boolean {
	const from = tree.entries.findIndex((e) => e.id === entryId);

	if (from === -1) {
		return false;
	}

	const to = Math.min(Math.max(toIndex, 0), tree.entries.length - 1);

	if (to === from) {
		return false;
	}

	const [entry] = tree.entries.splice(from, 1);
	tree.entries.splice(to, 0, entry);

	return true;
}
