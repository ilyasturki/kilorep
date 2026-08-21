import type { Exercise, Grip, GripAxis, MuscleTargets } from './exercise.ts';

function axisOf(meta: Exercise | undefined): GripAxis | undefined {
	return meta === undefined ? undefined : meta.grips;
}

/** The values this exercise can be gripped by, empty when it has no axis at all. */
export function gripsOf(meta: Exercise | undefined): Grip[] {
	const axis = axisOf(meta);

	return axis === undefined ? [] : axis.values;
}

export function hasGrips(meta: Exercise | undefined): boolean {
	return gripsOf(meta).length > 0;
}

/**
 * The value actually in force on a set.
 *
 * Absent means the default — every set has a grip, including the ones logged before the axis
 * existed. A value the catalog no longer lists falls back to the default rather than surviving
 * as a chip nobody can pick again.
 */
export function settleGrip(
	meta: Exercise | undefined,
	grip: string | null | undefined
): string | undefined {
	const axis = axisOf(meta);

	if (axis === undefined) {
		return undefined;
	}

	const wanted = grip ?? axis.default;

	return axis.values.some((value) => value.id === wanted) ? wanted : axis.default;
}

export function gripOf(
	meta: Exercise | undefined,
	grip: string | null | undefined
): Grip | undefined {
	const settled = settleGrip(meta, grip);

	return gripsOf(meta).find((value) => value.id === settled);
}

export function gripLabel(
	meta: Exercise | undefined,
	grip: string | null | undefined
): string | undefined {
	const value = gripOf(meta, grip);

	return value === undefined ? undefined : value.label;
}

/**
 * The key a set's history is filed under.
 *
 * The default value files under the bare slug and the others suffix it. That is not a
 * shortcut: it is what lets sets logged before the axis existed stay the default chip's
 * history without a migration, and what keeps every consumer that reads a plain `exerciseId`
 * — recency, the frequent shelf, volume, sets per muscle — reading the common case unchanged.
 */
export function historyKey(
	exerciseId: string,
	meta: Exercise | undefined,
	grip: string | null | undefined
): string {
	const axis = axisOf(meta);
	const settled = settleGrip(meta, grip);

	if (axis === undefined || settled === undefined || settled === axis.default) {
		return exerciseId;
	}

	return `${exerciseId}#${settled}`;
}

/**
 * Which muscles a grip actually trains.
 *
 * A close grip on a bench press is a triceps lift and a wide one is not, so a chip that could
 * not say so would push every close-grip set into the chest count on Sets per muscle.
 */
export function musclesOf(meta: Exercise, grip: string | null | undefined): MuscleTargets {
	const value = gripOf(meta, grip);

	return value === undefined || value.muscles === undefined ? meta.muscles : value.muscles;
}
