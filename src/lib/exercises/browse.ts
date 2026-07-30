/**
 * The browse shape of the catalog: sections by primary muscle, one row per
 * family. Presentation, not domain — which entry is a variant of which is the
 * catalog's fact, but folding a family into a row is this screen's choice, so
 * the walk stops at this boundary like `$lib/workout/groups` does.
 */

import { MUSCLES } from '$lib/domain/exercise';
import type { Exercise, Muscle } from '$lib/domain/exercise';

/** A canonical entry and the variations folded under its row. */
export type Family = { parent: Exercise; variants: Exercise[] };

export type Section = { muscle: Muscle; families: Family[] };

const byName = (a: Exercise, b: Exercise): number => a.name.localeCompare(b.name);

/**
 * Sections in `MUSCLES` order, empty ones absent. A family shelves under its
 * *parent's* primary — a close-grip bench led by triceps still lives with
 * Bench Press, because the row the user scans for is the family's, not the
 * variant's.
 *
 * A variant naming a parent the pool does not hold is promoted to a top-level
 * row rather than dropped: the catalog is authored by hand, and a typo in
 * `variantOf` must cost a misfiled row someone will see, never a vanished one.
 */
export function sections(pool: Exercise[]): Section[] {
	const ids = new Set(pool.map((exercise) => exercise.id));

	// One walk splits the pool: an entry is a parent row or it shelves under
	// one, so a per-parent rescan would only recompute this partition.
	const parents: Exercise[] = [];
	const variantsOf = new Map<string, Exercise[]>();

	for (const exercise of pool) {
		if (exercise.variantOf === undefined || !ids.has(exercise.variantOf)) {
			parents.push(exercise);
		} else {
			const siblings = variantsOf.get(exercise.variantOf);

			if (siblings === undefined) {
				variantsOf.set(exercise.variantOf, [exercise]);
			} else {
				siblings.push(exercise);
			}
		}
	}

	return MUSCLES.map((muscle) => ({
		muscle,
		families: parents
			.filter((exercise) => exercise.muscles.primary === muscle)
			.toSorted(byName)
			.map((parent) => ({
				parent,
				variants: (variantsOf.get(parent.id) ?? []).toSorted(byName)
			}))
	})).filter((section) => section.families.length > 0);
}

/**
 * The family around one entry, both directions: its canonical parent when it
 * is a variation, its variations when it is the canonical one. One owner with
 * `sections` for what "family" means, so the detail screen and the browse fold
 * cannot drift apart. A `variantOf` naming an entry the pool does not hold
 * resolves to no parent — the same authoring typo `sections` surfaces as a
 * promoted row.
 */
export function familyOf(
	pool: Exercise[],
	exercise: Exercise
): { parent: Exercise | null; variants: Exercise[] } {
	return {
		parent: pool.find((entry) => entry.id === exercise.variantOf) ?? null,
		variants: pool.filter((entry) => entry.variantOf === exercise.id).toSorted(byName)
	};
}
