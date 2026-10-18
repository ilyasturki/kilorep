import { catalogById } from '$lib/catalog';
import type { PlanChange, PlanSwap } from '$lib/domain/drift';
import { gripLabel } from '$lib/domain/grip';

function nameOf(exerciseId: string): string {
	return catalogById[exerciseId]?.name ?? exerciseId;
}

export function changeLabel(change: PlanChange): string {
	switch (change.kind) {
		case 'sets': {
			const delta = change.to - change.from;
			const count = Math.abs(delta);

			return `${nameOf(change.exerciseId)} ${delta > 0 ? '+' : '−'}${count} set${count === 1 ? '' : 's'}`;
		}
		case 'grip':
			return `${nameOf(change.exerciseId)}: ${gripLabel(catalogById[change.exerciseId], change.grip) ?? change.grip}`;
		case 'added':
			return `${nameOf(change.exerciseId)} added`;
		case 'removed':
			return `${nameOf(change.exerciseId)} not done`;
		case 'order':
			return 'new order';
		case 'supersets':
			return 'supersets changed';
	}
}

export function changesLine(changes: PlanChange[]): string {
	return changes.map((change) => changeLabel(change)).join(' · ');
}

export function swapLabel(swap: PlanSwap): string {
	return `Replace ${nameOf(swap.from)} with ${nameOf(swap.to)}`;
}
