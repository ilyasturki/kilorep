export type LoadMode = 'total' | 'per-hand' | 'unilateral';

export function loadFactor(mode: LoadMode): number {
	return mode === 'total' ? 1 : 2;
}

export function weightStep(equipment: Equipment): number {
	return equipment === 'Dumbbell' || equipment === 'Kettlebell' ? 2 : 2.5;
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

export type Exercise = {
	id: string;
	name: string;
	aliases: string[];
	equipment: Equipment;
	loadMode: LoadMode;
	muscles: MuscleTargets;
	variantOf?: string;
	/**
	 * The share of the lifter's own body weight this movement makes them carry.
	 *
	 * Absent is zero, which is every exercise loaded by a bar, a stack or a bell: those move
	 * what was put on them and nothing else. Coarse on purpose — a share to two decimals
	 * would claim a measurement nobody took.
	 */
	bodyweightShare?: number;
};
