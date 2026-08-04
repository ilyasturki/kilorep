type Close = () => void;

const stack: Close[] = [];

export function registerOverlay(close: Close): () => void {
	stack.push(close);

	return () => {
		const index = stack.lastIndexOf(close);
		if (index !== -1) {
			stack.splice(index, 1);
		}
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

	top();
	return true;
}
