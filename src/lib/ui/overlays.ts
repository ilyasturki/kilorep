type Close = () => void;

const stack: Close[] = [];

const watchers = new Set<() => void>();

// The stack is imperative rather than reactive on purpose — a `$state` here would drag
// every consumer into a `.svelte.ts` — so what changes has to be announced. The hardware
// back button is the one caller that must know the moment it happens rather than the next
// time it is asked: whether Android or the app answers the next press is a question the
// platform asks before the press, and an overlay is half of that answer.
function announce(): void {
	for (const watcher of watchers) {
		watcher();
	}
}

export function watchOverlays(watcher: () => void): () => void {
	watchers.add(watcher);

	return () => {
		watchers.delete(watcher);
	};
}

export function registerOverlay(close: Close): () => void {
	stack.push(close);
	announce();

	return () => {
		const index = stack.lastIndexOf(close);
		if (index !== -1) {
			stack.splice(index, 1);
		}

		// Announced either way: `closeTopOverlay` popped this entry before running it, so the
		// splice above finds nothing and the close it was called for still happened.
		announce();
	};
}

export function hasOpenOverlay(): boolean {
	return stack.length > 0;
}

export function closeTopOverlay(): boolean {
	const top = stack.pop();
	if (top === undefined) {
		return false;
	}

	announce();
	top();
	return true;
}
