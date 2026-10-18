import type { PlanChange, PlanSwap } from '$lib/domain/drift';
import type { Exercise } from '$lib/domain/exercise';
import { gripLabel } from '$lib/domain/grip';
import type { Workout } from '$lib/domain/workout';

type Lookup = (exerciseId: string) => Exercise | undefined;

function nameOf(exerciseId: string, lookup: Lookup): string {
	const meta = lookup(exerciseId);

	return meta === undefined ? exerciseId : meta.name;
}

function setsLabel(from: number, to: number): string {
	const count = Math.abs(to - from);

	return `${to > from ? '+' : '−'}${count} set${count === 1 ? '' : 's'}`;
}

export function changeLabel(change: PlanChange, lookup: Lookup): string {
	if (change.kind === 'order') {
		return 'new order';
	}

	if (change.kind === 'supersets') {
		return 'supersets changed';
	}

	const name = nameOf(change.exerciseId, lookup);

	if (change.kind === 'sets') {
		return `${name} ${setsLabel(change.from, change.to)}`;
	}

	if (change.kind === 'grip') {
		return `${name}: ${gripLabel(lookup(change.exerciseId), change.grip) ?? change.grip}`;
	}

	return change.kind === 'added' ? `${name} added` : `${name} not done`;
}

export function changesLine(changes: PlanChange[], lookup: Lookup): string {
	return changes.map((change) => changeLabel(change, lookup)).join(' · ');
}

export function swapLabel(swap: PlanSwap, lookup: Lookup): string {
	return `Replace ${nameOf(swap.from, lookup)} with ${nameOf(swap.to, lookup)}`;
}

export type OfferState = {
	newest: string | null;
	answered: string | null;
	planWrittenAt: number | null;
};

// A plan written since the session began was revisited after it: Update would undo that edit.
export function offerStands(workout: Workout, state: OfferState): boolean {
	return (
		state.newest === workout.id &&
		state.answered !== workout.id &&
		(state.planWrittenAt === null || state.planWrittenAt <= workout.startedAt)
	);
}
