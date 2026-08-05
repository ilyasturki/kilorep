import { MUSCLES } from '$lib/domain/exercise';
import type { Exercise, Muscle } from '$lib/domain/exercise';

export type Family = { parent: Exercise; variants: Exercise[] };

export type Section = { muscle: Muscle; families: Family[] };

const byName = (a: Exercise, b: Exercise): number => a.name.localeCompare(b.name);

export function sections(pool: Exercise[]): Section[] {
	const ids = new Set(pool.map((exercise) => exercise.id));

	const parents: Exercise[] = [];
	const variantsOf = new Map<string, Exercise[]>();

	for (const exercise of pool) {
		if (exercise.variantOf === undefined || !ids.has(exercise.variantOf)) {
			parents.push(exercise);
		} else {
			const siblings = variantsOf.get(exercise.variantOf) ?? [];

			siblings.push(exercise);
			variantsOf.set(exercise.variantOf, siblings);
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
 * Every other member of `exercise`'s family, flat and by name: its parent, its
 * parent's other children, or — when it is the parent — its own. One list and
 * no direction, because a variant relation is symmetric to the person reading
 * it: whoever is on screen, the rest of the family is what they might have
 * meant instead. `variantOf` still names a canonical parent, and the browse
 * fold still reads it; that asymmetry belongs to the shelf, not to this list.
 *
 * A `variantOf` naming an exercise the pool lacks makes the entry its own root,
 * exactly as `sections` treats it — the two must agree or a family would shelve
 * under a head that its own members do not list.
 */
export function kin(pool: Exercise[], exercise: Exercise): Exercise[] {
	const ids = new Set(pool.map((entry) => entry.id));

	const root =
		exercise.variantOf !== undefined && ids.has(exercise.variantOf)
			? exercise.variantOf
			: exercise.id;

	return pool
		.filter((entry) => entry.id !== exercise.id && (entry.id === root || entry.variantOf === root))
		.toSorted(byName);
}

export function similarTo(pool: Exercise[], exercise: Exercise, limit = 6): Exercise[] {
	const family = new Set(kin(pool, exercise).map((entry) => entry.id));

	const tier = (candidate: Exercise): number => {
		if (family.has(candidate.id)) {
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
