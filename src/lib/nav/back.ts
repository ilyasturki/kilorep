export type BackDecision =
	| { kind: 'close-overlay' }
	| { kind: 'pop' }
	| { kind: 'replace'; path: string }
	| { kind: 'minimize' };

export type BackContext = {
	overlayOpen: boolean;
	target: string | null;
	behind: string | null;
};

// A bare target is that screen in whatever state it was left: a filtered list is still the list.
function walksTo(behind: string | null, target: string): boolean {
	return (
		behind === target ||
		(behind !== null && !target.includes('?') && behind.split('?')[0] === target)
	);
}

// A back never pushes, or the browser's own back would replay it.
export function decideBack({ overlayOpen, target, behind }: BackContext): BackDecision {
	if (overlayOpen) {
		return { kind: 'close-overlay' };
	}

	if (target === null) {
		return { kind: 'minimize' };
	}

	return walksTo(behind, target) ? { kind: 'pop' } : { kind: 'replace', path: target };
}
