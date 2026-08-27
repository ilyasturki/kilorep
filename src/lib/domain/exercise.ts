export type LoadMode = 'total' | 'per-hand' | 'unilateral';

export function loadFactor(mode: LoadMode): number {
	return mode === 'total' ? 1 : 2;
}

/** Under this, the rack's dumbbells come in single kilos rather than pairs. */
const DUMBBELL_SINGLES = 10;

/**
 * How far an arm moves from `from`, going up (`direction` 1) or down (−1).
 *
 * A rack is not a uniform ladder. Under ten kilos the dumbbells step one at a time, and a
 * 2 kg jump there is a fifth of the load — the light end of an accessory lift is where the
 * step has to be finest, which is exactly where a constant is worst. The boundary belongs
 * to the finer half in both directions: stepping down off 10 lands on 9, stepping up off 9
 * lands on 10. Kettlebells keep their pairs — no rack sells them in single kilos.
 */
export function weightStep(equipment: Equipment, from: number, direction: number): number {
	if (equipment === 'Kettlebell') {
		return 2;
	}

	if (equipment !== 'Dumbbell') {
		return 2.5;
	}

	const fine = direction < 0 ? from <= DUMBBELL_SINGLES : from < DUMBBELL_SINGLES;

	return fine ? 1 : 2;
}

export type Equipment =
	| 'Barbell'
	| 'EZ-Bar'
	| 'Dumbbell'
	| 'Cable'
	| 'Machine'
	| 'Smith Machine'
	| 'Bodyweight'
	| 'Kettlebell'
	| 'Band';

/** Implements a single hand or foot can take on its own: a dumbbell, a stack, a bell, a band. */
const HANDHELD: ReadonlySet<Equipment> = new Set([
	'Dumbbell',
	'Cable',
	'Machine',
	'Kettlebell',
	'Band'
]);

/**
 * Whether a set of this exercise can honestly claim one arm did the work.
 *
 * A barbell, a Smith bar or the lifter's own body offers nothing a single side can take, and a
 * unilateral movement is already one side at a time — the chip would restate the exercise.
 * Unknown metadata keeps the offer: recording a fact is cheaper than refusing one.
 */
export function singleArmable(meta: Exercise | undefined): boolean {
	if (meta === undefined) {
		return true;
	}

	return meta.loadMode !== 'unilateral' && HANDHELD.has(meta.equipment);
}

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

export type MuscleTargets = { primary: Muscle; secondary: Muscle[] };

/**
 * One value of an exercise's grip axis — a rope, a close grip, a neutral handle.
 *
 * It carries its own muscle targets when the grip really moves them: a close-grip bench press
 * is a triceps lift where the wide one is a chest lift, and a chip that could not say so would
 * file every close-grip set under the chest.
 */
export type Grip = {
	id: string;
	label: string;
	muscles?: MuscleTargets;
};

/** The one way an exercise can be varied without becoming another exercise. */
export type GripAxis = {
	/** What the axis is called where it is chosen: "Grip", "Attachment", "Handle". */
	label: string;
	/** The value every set carries until one is picked, and the one filed under the bare slug. */
	default: string;
	values: Grip[];
};

export type Exercise = {
	id: string;
	name: string;
	aliases: string[];
	equipment: Equipment;
	loadMode: LoadMode;
	muscles: MuscleTargets;
	variantOf?: string;
	grips?: GripAxis;
	/**
	 * The share of the lifter's own body weight this movement makes them carry.
	 *
	 * Absent is zero, which is every exercise loaded by a bar, a stack or a bell: those move
	 * what was put on them and nothing else. Coarse on purpose — a share to two decimals
	 * would claim a measurement nobody took.
	 */
	bodyweightShare?: number;
};
