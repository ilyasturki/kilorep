import { catalogById } from '$lib/catalog';
import type { PlanChange, PlanSwap } from '$lib/domain/drift';
import type { Exercise } from '$lib/domain/exercise';
import { gripLabel } from '$lib/domain/grip';

function nameOf(exerciseId: string): string {
	const meta: Exercise | undefined = catalogById[exerciseId];

	return meta === undefined ? exerciseId : meta.name;
}

function setsLabel(from: number, to: number): string {
	const count = Math.abs(to - from);

	return `${to > from ? '+' : '−'}${count} set${count === 1 ? '' : 's'}`;
}

export function changeLabel(change: PlanChange): string {
	if (change.kind === 'order') {
		return 'new order';
	}

	if (change.kind === 'supersets') {
		return 'supersets changed';
	}

	const name = nameOf(change.exerciseId);

	if (change.kind === 'sets') {
		return `${name} ${setsLabel(change.from, change.to)}`;
	}

	if (change.kind === 'grip') {
		return `${name}: ${gripLabel(catalogById[change.exerciseId], change.grip) ?? change.grip}`;
	}

	return change.kind === 'added' ? `${name} added` : `${name} not done`;
}

export function changesLine(changes: PlanChange[]): string {
	return changes.map((change) => changeLabel(change)).join(' · ');
}

export function swapLabel(swap: PlanSwap): string {
	return `Replace ${nameOf(swap.from)} with ${nameOf(swap.to)}`;
}
