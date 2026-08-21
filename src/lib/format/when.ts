export const DAY_MS = 86_400_000;

function startOfDay(ms: number): number {
	const date = new Date(ms);

	date.setHours(0, 0, 0, 0);

	return date.getTime();
}

/**
 * Calendar days from one moment to another, counted in midnights crossed.
 *
 * Math.round, not floor: across a DST boundary the gap between two midnights is 23 or
 * 25 hours, and dividing that by a flat day would lose or invent one.
 */
export function midnightsBetween(then: number, now: number): number {
	return Math.round((startOfDay(now) - startOfDay(then)) / DAY_MS);
}

export function countedDays(days: number): string | null {
	if (days < 1) {
		return 'Today';
	}

	if (days === 1) {
		return 'Yesterday';
	}

	return days < 7 ? `${days}d` : null;
}

const CLOCK = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' });

const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });

/**
 * When sync last reached the server, at the precision that matters from that distance.
 *
 * Minutes while it is still the same errand, a clock time once it is this morning's,
 * and a bare date once the count of days has stopped meaning anything.
 */
export function syncedWhen(at: number, now: number): string {
	const seconds = Math.max(0, Math.round((now - at) / 1000));

	if (seconds < 60) {
		return 'just now';
	}

	if (seconds < 3600) {
		return `${Math.floor(seconds / 60)}m ago`;
	}

	const days = midnightsBetween(at, now);

	if (days < 1) {
		return CLOCK.format(at);
	}

	if (days === 1) {
		return `yesterday ${CLOCK.format(at)}`;
	}

	return DATE.format(at);
}
