import { goto } from '$app/navigation';

import { decideBack } from '$lib/nav/back';
import { backTo } from '$lib/nav/bar.svelte';
import { stack } from '$lib/nav/stack.svelte';
import { closeTopOverlay, hasOpenOverlay } from '$lib/ui/overlays';

import type { BackDecision } from '$lib/nav/back';

let retreat: string | null = null;

/** Whether the navigation landing on `address` is a back that replaced rather than popped. */
export function retreatingTo(address: string): boolean {
	return retreat === address;
}

export function backDecision(): BackDecision {
	return decideBack({
		overlayOpen: hasOpenOverlay(),
		target: backTo(new URL(location.href), stack.behind),
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

export async function goBack(): Promise<void> {
	await follow(backDecision());
}

/** Leaves this screen for `target` the way back would: a pop when it is behind, else a replace. */
export async function leaveFor(target: string): Promise<void> {
	await follow(decideBack({ overlayOpen: false, target, behind: stack.behind }));
}

/** Leaves a screen whose subject is gone — deleted, finished — for where its back walks. */
export async function leave(fallback: string): Promise<void> {
	await leaveFor(backTo(new URL(location.href), stack.behind) ?? fallback);
}
