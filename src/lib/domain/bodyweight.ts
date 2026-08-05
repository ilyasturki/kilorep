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

/**
 * Calendar days from `from` to `to`, positive when `to` is the later of the
 * two. Through the same UTC day numbers `addDays` runs on, which is what makes
 * it survive a DST boundary — the two midnights either side of one are 23 or 25
 * hours apart, and a subtraction of local timestamps would round to the wrong
 * day exactly twice a year.
 */
export function daysBetween(from: string, to: string): number {
	return dayNumber(to) - dayNumber(from);
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

/**
 * How far back the trend is drawn. Four, and no more: a range picker with a
 * dozen rungs is a control you configure rather than one you glance at, and
 * these are the four questions a lifter actually asks — this block, this
 * season, this year, the whole story.
 */
export const CHART_RANGES = ['12w', '6mo', '1y', 'all'] as const;

export type ChartRange = (typeof CHART_RANGES)[number];

export function isChartRange(value: unknown): value is ChartRange {
	return CHART_RANGES.some((range) => range === value);
}

/**
 * The window's length in days, or `null` for the one range that has no length.
 * Months are 30 days and a year is 365 — a window is a viewport, not an
 * anniversary, and a calendar-exact `6mo` would shift its own left edge by a
 * day or two depending on which months it happened to span.
 */
const RANGE_DAYS: Record<ChartRange, number | null> = {
	'12w': 84,
	'6mo': 183,
	'1y': 365,
	all: null
};

/**
 * The first day the chart draws. For `all` that is the first weigh-in ever, and
 * for an empty log it is `today` — a chart with no width is still a chart with
 * a valid domain, which is what keeps the caller from having to special-case it
 * on top of the empty check it already makes.
 */
export function rangeStart(entries: BodyweightEntry[], today: string, range: ChartRange): string {
	const days = RANGE_DAYS[range];

	if (days !== null) {
		return addDays(today, -(days - 1));
	}

	const first = entries.at(0);

	return first === undefined ? today : first.date;
}

/** The entries inside a range, oldest first — `windowed` with `all` folded in. */
export function inRange(
	entries: BodyweightEntry[],
	today: string,
	range: ChartRange
): BodyweightEntry[] {
	const from = rangeStart(entries, today, range);

	return entries.filter((entry) => entry.date >= from && entry.date <= today);
}

/**
 * One calendar month of the log: its entries newest first, what they averaged,
 * and how that compares with the month before.
 *
 * `change` is average against average, and never last-entry against
 * last-entry — a log with three weigh-ins in March and one on the 2nd of April
 * would otherwise report April's whole "change" from a single morning, which is
 * a number that moves ±1 kg on water alone.
 *
 * The month it compares against is the previous *group*, not the previous
 * calendar month. Skip October entirely and November reads against September,
 * which is the only honest answer available: the alternative is a null every
 * time somebody stops weighing for four weeks, on the row where the change is
 * most worth seeing.
 */
export type MonthGroup = {
	/** `YYYY-MM`, which sorts and formats without a parse. */
	month: string;
	entries: BodyweightEntry[];
	average: number;
	change: number | null;
};

function mean(of: BodyweightEntry[]): number {
	return of.reduce((sum, entry) => sum + entry.kg, 0) / of.length;
}

export function monthGroups(entries: BodyweightEntry[]): MonthGroup[] {
	const byMonth = new Map<string, BodyweightEntry[]>();

	for (const entry of entries) {
		const month = entry.date.slice(0, 7);
		const bucket = byMonth.get(month) ?? [];

		bucket.push(entry);
		byMonth.set(month, bucket);
	}

	// Oldest first while the averages are chained, reversed at the end: each
	// month's change is the one before it, and walking backwards to find that is
	// an off-by-one waiting to happen.
	const months = [...byMonth.keys()].toSorted();

	return months
		.map((month, index): MonthGroup => {
			const own = byMonth.get(month) ?? [];
			const before = index === 0 ? undefined : byMonth.get(months[index - 1]);
			const average = mean(own);

			return {
				month,
				entries: own.toReversed(),
				average,
				change: before === undefined ? null : average - mean(before)
			};
		})
		.toReversed();
}
