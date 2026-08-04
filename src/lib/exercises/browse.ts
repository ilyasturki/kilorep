import { MUSCLES } from '$lib/domain/exercise';
import type { Exercise, Muscle } from '$lib/domain/exercise';
import type { MainVariants } from '$lib/domain/preference';

export type Family = { parent: Exercise; variants: Exercise[] };

export function applyMains(pool: Exercise[], mains: MainVariants): Exercise[] {
	const byId = new Map(pool.map((exercise) => [exercise.id, exercise]));

	const chosen = new Map<string, string>();

	for (const [family, main] of Object.entries(mains)) {
		const entry = byId.get(main);

		if (main !== family && entry !== undefined && entry.variantOf === family) {
			chosen.set(family, main);
		}
	}

	if (chosen.size === 0) {
		return pool;
	}

	return pool.map((exercise) => {
		const family = exercise.variantOf ?? exercise.id;
		const main = chosen.get(family);

		if (main === undefined) {
			return exercise;
		}

		if (exercise.id === main) {
			return {
				id: exercise.id,
				name: exercise.name,
				aliases: exercise.aliases,
				equipment: exercise.equipment,
				loadMode: exercise.loadMode,
				muscles: exercise.muscles
			};
		}

		return {
			id: exercise.id,
			name: exercise.name,
			aliases: exercise.aliases,
			equipment: exercise.equipment,
			loadMode: exercise.loadMode,
			muscles: exercise.muscles,
			variantOf: main
		};
	});
}

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

export function familyOf(
	pool: Exercise[],
	exercise: Exercise
): { parent: Exercise | null; variants: Exercise[] } {
	return {
		parent: pool.find((entry) => entry.id === exercise.variantOf) ?? null,
		variants: pool.filter((entry) => entry.variantOf === exercise.id).toSorted(byName)
	};
}

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

export function similarTo(pool: Exercise[], exercise: Exercise, limit = 6): Exercise[] {
	const kin = kinOf(pool, exercise);

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
