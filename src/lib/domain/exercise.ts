/**
 * What an exercise *is*, apart from any workout that performs one.
 *
 * Split from `workout.ts` because the two grow for different reasons: the
 * workout tree changes when the logging loop changes, and this shape changes
 * when the catalog does. Plain TypeScript with zero framework imports, per
 * STACK.md's standing rule — the catalog data, the search module and the
 * screens all read these types, and none of them may drag a framework in here.
 */

/**
 * How the weight figure on a set relates to the load actually moved. Volume
 * multiplies by 2 for `per-hand` (a dumbbell in each hand, logged once) and
 * `unilateral` (one side at a time, reps counted per side).
 *
 * A fourth mode — single side, ×1, for the set that drops to one arm — is
 * settled but deliberately absent: it is a per-set override, never an
 * exercise's default, and it lands with the set-extras work.
 */
export type LoadMode = 'total' | 'per-hand' | 'unilateral';

/** The multiplier above, as volume math reads it. */
export function loadFactor(mode: LoadMode): number {
	return mode === 'total' ? 1 : 2;
}

/**
 * The ± increment the weight stepper uses for an exercise, in kg.
 *
 * Racked implements move in the jumps the rack was bought in: dumbbells and
 * kettlebells almost universally 2 kg apart, so ±2.5 from an 8 kg bell
 * proposed a 10.5 that exists in no gym, and every second tap needed a typed
 * correction. Everything plate-loaded or pin-stacked keeps 2.5, the smallest
 * pair of plates worth racking.
 *
 * A rule on equipment rather than a per-exercise setting: the catalog already
 * says what each exercise is lifted with, and a preference to maintain per
 * exercise is friction the loop rule does not allow. Typing stays the way to
 * any weight the arms cannot reach.
 */
export function weightStep(equipment: Equipment): number {
	return equipment === 'Dumbbell' || equipment === 'Kettlebell' ? 2 : 2.5;
}

/**
 * A closed union rather than a free string, so the browse screen can filter
 * and group without a normalisation pass, and so two catalog entries cannot
 * spell the same rack two ways.
 */
export type Equipment =
	'Barbell' | 'Dumbbell' | 'Cable' | 'Machine' | 'Bodyweight' | 'Kettlebell' | 'Band';

/**
 * Deliberately coarse: eleven groups, not thirty muscles. The consumer that
 * matters is the Dashboard's "Balanced?" card — working volume by muscle over
 * recent weeks — and "am I neglecting something" is answerable at this grain,
 * where finer splits produce rows too thin to read and authoring debates with
 * no right answer. The array is the display order of the browse screen's
 * sections, roughly top of the body to bottom.
 */
export const MUSCLES = [
	'Chest',
	'Back',
	'Shoulders',
	'Biceps',
	'Triceps',
	'Forearms',
	'Core',
	'Quads',
	'Hamstrings',
	'Glutes',
	'Calves'
] as const;

export type Muscle = (typeof MUSCLES)[number];

/**
 * One primary and any number of secondaries, rather than a flat list: the
 * distinction is how lifters describe an exercise, and it is what shelves the
 * browse list (an exercise sits in its primary's section). The Balanced? card
 * settled its side when it was built: volume counts toward the primary alone
 * — see `muscleVolume` in `$lib/domain/dashboard` for the reasoning.
 */
export type MuscleTargets = { primary: Muscle; secondary: Muscle[] };

/**
 * A catalog entry or, later, a custom. The id is a human-readable slug for
 * catalog entries (`bench-press`) — stable forever, never deleted or reused,
 * because every workout record carries it and a broken slug is a workout that
 * can no longer say what it was. Customs, when they arrive, will mint UUIDs
 * instead, which is what keeps them from colliding with a slug the catalog
 * has not grown yet.
 */
export type Exercise = {
	id: string;
	name: string;
	/**
	 * What search answers to besides the name: gym abbreviations and synonyms
	 * ("ohp", "military press"). Never rendered, so an alias costs nothing on
	 * screen and earns its place purely by being typed.
	 */
	aliases: string[];
	equipment: Equipment;
	loadMode: LoadMode;
	muscles: MuscleTargets;
	/**
	 * The slug of the canonical parent, present only on variations. A variation
	 * whose load or emphasis differs is a real entry — own history, own hints,
	 * own PRs, because a close-grip pulldown hinted with wide-grip numbers is
	 * the hint lying — and this link is what lets the browse list fold a family
	 * into one row anyway. Same movement under another name is an alias, not a
	 * variant.
	 */
	variantOf?: string;
};
