export type BodyweightEntry = { date: string; kg: number };

export function bodyweightId(date: string): string {
	return `bodyweight-${date}`;
}

/**
 * The calendar day a moment belongs to, in the clock's own timezone. Takes a
 * `Date` rather than reading one — this module has no clock, the same rule
 * that keeps `startedAt` an argument everywhere else — and the caller passes
 * `new Date()` at the edge.
 */
export function localDateOf(at: Date): string {
	const month = String(at.getMonth() + 1).padStart(2, '0');
	const day = String(at.getDate()).padStart(2, '0');

	return `${at.getFullYear()}-${month}-${day}`;
}

/**
 * Days since the epoch, for calendar arithmetic. Through `Date.UTC` and never
 * local time: a date string is timezone-less, and running it through a local
 * clock would let a DST switch make two adjacent days 25 hours apart and
 * shift every window by one.
 */
function dayNumber(date: string): number {
	const [year, month, day] = date.split('-').map(Number);

	return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function addDays(date: string, days: number): string {
	return new Date((dayNumber(date) + days) * 86_400_000).toISOString().slice(0, 10);
}

export function rollingAverage(entries: BodyweightEntry[], windowDays = 7): BodyweightEntry[] {
	const out: BodyweightEntry[] = [];

	for (let i = 0; i < entries.length; i++) {
		const from = dayNumber(entries[i].date) - (windowDays - 1);

		let sum = 0;
		let count = 0;

		for (let j = i; j >= 0 && dayNumber(entries[j].date) >= from; j--) {
			sum += entries[j].kg;
			count++;
		}

		out.push({ date: entries[i].date, kg: sum / count });
	}

	return out;
}

export function weeklyRate(line: BodyweightEntry[]): number | null {
	const first = line.at(0);
	const last = line.at(-1);

	if (first === undefined || last === undefined) {
		return null;
	}

	const days = dayNumber(last.date) - dayNumber(first.date);

	return days < 14 ? null : ((last.kg - first.kg) / days) * 7;
}

/**
 * The entries inside the chart's window: the last `days` calendar days ending
 * on `today`, inclusive. ISO dates order lexicographically, so the cut is a
 * string comparison — no parsing, no clock.
 */
export function windowed(
	entries: BodyweightEntry[],
	today: string,
	days: number
): BodyweightEntry[] {
	const from = addDays(today, -(days - 1));

	return entries.filter((entry) => entry.date >= from && entry.date <= today);
}
