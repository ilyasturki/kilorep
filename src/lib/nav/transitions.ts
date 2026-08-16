import type { OnNavigate } from '@sveltejs/kit';
import { tick } from 'svelte';
import { prefersReducedMotion } from 'svelte/motion';
import { onNavigate } from '$app/navigation';

import { tabRoots } from '$lib/nav/bar.svelte';
import { classifyMove } from '$lib/nav/move';
import { coarsePointer } from '$lib/ui/pointer';

import type { Direction } from '$lib/nav/move';

function outsideShell(pathname: string): boolean {
	return pathname === '/' || pathname === '/login' || pathname.startsWith('/dev');
}

function slidingWanted(): boolean {
	return (
		coarsePointer &&
		typeof document.startViewTransition === 'function' &&
		!prefersReducedMotion.current
	);
}

let stampOwner: ViewTransition | undefined;

async function unstamp(transition: ViewTransition): Promise<void> {
	try {
		await transition.finished;
	} catch {
		/* empty */
	} finally {
		if (stampOwner === transition) {
			stampOwner = undefined;

			const { dataset } = document.documentElement;

			delete dataset.nav;
		}
	}
}

// Any ending that is not a clean finish rejects `ready`, `updateCallbackDone`
// and `finished` alike; unread they surface as `unhandledrejection`.
async function absorb(settling: Promise<void>): Promise<void> {
	try {
		await settling;
	} catch {
		/* empty */
	}
}

// Stamped before `startViewTransition`: the browser captures during the
// rendering update that follows, so the write is in the captured style.
function slide(direction: Direction, update: () => Promise<void>): void {
	const { dataset } = document.documentElement;

	dataset.nav = direction;

	const transition = document.startViewTransition(update);

	stampOwner = transition;

	void absorb(transition.ready);
	void absorb(transition.updateCallbackDone);
	void unstamp(transition);
}

function navigationMove(navigation: OnNavigate): Direction | undefined {
	const { from, to } = navigation;

	if (from === null || to === null) {
		return undefined;
	}

	const a = from.url.pathname;
	const b = to.url.pathname;

	if (a === b || outsideShell(a) || outsideShell(b)) {
		return undefined;
	}

	return classifyMove({
		from: a,
		to: b,
		delta: navigation.delta ?? undefined,
		tabRoots: tabRoots()
	});
}

export function slideNavigation(): void {
	onNavigate(async (navigation) => {
		if (!slidingWanted()) {
			return;
		}

		const move = navigationMove(navigation);

		if (move === undefined) {
			return;
		}

		const { promise, resolve }: PromiseWithResolvers<void> = Promise.withResolvers();

		slide(move, async () => {
			resolve();
			await navigation.complete;
		});

		await promise;
	});
}

export function pageSlide(direction: Direction, mutate: () => void): void {
	if (!slidingWanted()) {
		mutate();
		return;
	}

	slide(direction, async () => {
		mutate();
		await tick();
	});
}
