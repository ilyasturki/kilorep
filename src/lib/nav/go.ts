import { goto } from '$app/navigation';

import { decideBack } from '$lib/nav/back';
import { backTo } from '$lib/nav/bar.svelte';
import { stack } from '$lib/nav/stack.svelte';
import { closeTopOverlay, hasOpenOverlay } from '$lib/ui/overlays';

import type { BackDecision } from '$lib/nav/back';

let retreat: string | null = null;

let popping = false;

/** Whether the navigation landing on `address` is a back that replaced rather than popped. */
export function retreatingTo(address: string): boolean {
	return retreat === address;
}

// `location` moves at pushState and popstate, `stack` only once the navigation lands.
function settled(): URL {
	return new URL(stack.at ?? location.href, location.href);
}

export function backDecision(): BackDecision {
	return decideBack({
		overlayOpen: hasOpenOverlay(),
		target: backTo(settled(), stack.behind),
		behind: stack.behind
	});
}

/** Carries out every decision but `minimize`, which only the native shell can. */
export async function follow(decision: BackDecision): Promise<void> {
	switch (decision.kind) {
		case 'close-overlay': {
			closeTopOverlay();
			break;
		}
		case 'pop': {
			popping = true;
			history.back();
			break;
		}
		case 'replace': {
			retreat = decision.path;

			try {
				await goto(decision.path, { replaceState: true });
			} finally {
				retreat = null;
			}

			break;
		}
		case 'minimize': {
			break;
		}
	}
}

/** Whether a navigation about to happen is a browser back that should close an overlay instead. */
export function closesOverlay(type: string, delta: number | null = null): boolean {
	const ours = popping;

	popping = false;

	if (type !== 'popstate' || (delta ?? -1) >= 0 || ours || !hasOpenOverlay()) {
		return false;
	}

	closeTopOverlay();

	return true;
}

export async function goBack(): Promise<void> {
	await follow(backDecision());
}

export async function leaveFor(target: string): Promise<void> {
	await follow(decideBack({ overlayOpen: false, target, behind: stack.behind }));
}

/** Leaves a screen whose subject is gone — deleted, finished — for where its back walks. */
export async function leave(fallback: string): Promise<void> {
	await leaveFor(backTo(settled(), stack.behind) ?? fallback);
}
