export function countedDays(days: number): string | null {
	if (days < 1) {
		return 'Today';
	}

	if (days === 1) {
		return 'Yesterday';
	}

	return days < 7 ? `${days}d` : null;
}
