export type EnterReason = 'navigate' | 'reload' | 'back_forward' | 'prerender';

export type NavStep = { type: string; delta?: number | null };

const KEY = 'kilorep:back-depth';

export function depthOnEnter(stored: number, reason: EnterReason): number {
	return reason === 'navigate' ? 0 : Math.max(0, stored);
}

export function depthAfter(depth: number, step: NavStep): number {
	if (step.type === 'popstate') {
		return Math.max(0, depth + (step.delta ?? 0));
	}

	if (step.type === 'link' || step.type === 'goto' || step.type === 'form') {
		return depth + 1;
	}

	return depth;
}

let counted = 0;

function readStored(): number {
	try {
		return Number(sessionStorage.getItem(KEY)) || 0;
	} catch {
		return 0;
	}
}

function writeStored(value: number): void {
	try {
		sessionStorage.setItem(KEY, String(value));
	} catch {
		// `sessionStorage` throws in Safari private mode and on quota.
	}
}

export function startDepthTracking(): void {
	const [entry] = performance.getEntriesByType('navigation');
	const reason: EnterReason =
		entry instanceof PerformanceNavigationTiming ? entry.type : 'navigate';

	counted = depthOnEnter(readStored(), reason);
	writeStored(counted);
}

export function recordNavigation(step: NavStep): void {
	counted = depthAfter(counted, step);
	writeStored(counted);
}

export function backDepth(): number {
	return Math.min(counted, Math.max(0, history.length - 1));
}
