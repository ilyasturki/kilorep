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

/**
 * Every entry in `exercise`'s family but `exercise` itself: its parent and that
 * parent's other children when it is a variation, its own children when it is
 * the canonical one. One set of ids because the tiers below only ask whether a
 * candidate is kin, never how.
 */
function kinOf(pool: Exercise[], exercise: Exercise): Set<string> {
	const family = familyOf(pool, exercise);

	const kin =
		family.parent === null
			? family.variants
			: [family.parent, ...familyOf(pool, family.parent).variants];

	const ids = new Set(kin.map((entry) => entry.id));
	ids.delete(exercise.id);

	return ids;
}

/**
 * What to offer first when this exercise is being replaced, best answer first.
 *
 * A swap is asked under duress — the rack is taken, the shoulder is complaining,
 * the machine has a queue — and the answer is almost never "search the catalog".
 * It is one of a handful of exercises that would do instead, which is a
 * question the pool can answer and the browse sections cannot: they shelve by
 * muscle, so the substitute for a Bench Press sits eleven rows below it behind
 * a scroll.
 *
 * Three tiers, and the order is what a lifter would say out loud:
 *
 * 1. **The family.** Incline for flat, close-grip for standard. Same movement,
 *    different emphasis, and the load carries across better than anything else
 *    on this list.
 * 2. **Same muscle, same rack.** Still on the barbell, still chest — the change
 *    of exercise without a change of plan.
 * 3. **Same muscle, another rack.** The tier that actually answers "the bench
 *    is taken", so it is present rather than merely last.
 *
 * Secondary muscles are deliberately not read. They would pull half the catalog
 * into tier 3 — nearly everything works triceps somewhere — and a similar list
 * that is not short is just the browse list with the shelving taken off.
 *
 * Alphabetical inside a tier, like every other list here, and capped: this is a
 * shortcut sitting above the real list, and one that runs past a screen has
 * stopped being one. Presentation, so it lives here and not in the domain.
 */
export function similarTo(pool: Exercise[], exercise: Exercise, limit = 6): Exercise[] {
	const kin = kinOf(pool, exercise);

	// -1 drops out below. Tier 0 is kin regardless of muscle: a variation that
	// shelves under another primary — a close-grip bench led by triceps — is
	// still the first thing anyone would reach for.
	const tier = (candidate: Exercise): number => {
		if (kin.has(candidate.id)) {
			return 0;
		}

		if (candidate.muscles.primary !== exercise.muscles.primary) {
			return -1;
		}

		return candidate.equipment === exercise.equipment ? 1 : 2;
	};

	return pool
		.filter((candidate) => candidate.id !== exercise.id)
		.map((candidate) => ({ candidate, tier: tier(candidate) }))
		.filter((scored) => scored.tier !== -1)
		.toSorted((a, b) => a.tier - b.tier || byName(a.candidate, b.candidate))
		.slice(0, limit)
		.map((scored) => scored.candidate);
}
