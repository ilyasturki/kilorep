export type BodyweightEntry = { date: string; kg: number };

export function bodyweightId(date: string): string {
	return `bodyweight-${date}`;
}

export function localDateOf(at: Date): string {
	const month = String(at.getMonth() + 1).padStart(2, '0');
	const day = String(at.getDate()).padStart(2, '0');

	return `${at.getFullYear()}-${month}-${day}`;
}

// Date.UTC, never local time: a DST switch makes adjacent local days 23/25h apart
// and would shift every window by one.
function dayNumber(date: string): number {
	const [year, month, day] = date.split('-').map(Number);

	return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function addDays(date: string, days: number): string {
	return new Date((dayNumber(date) + days) * 86_400_000).toISOString().slice(0, 10);
}

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

export function windowed(
	entries: BodyweightEntry[],
	today: string,
	days: number
): BodyweightEntry[] {
	const from = addDays(today, -(days - 1));

	return entries.filter((entry) => entry.date >= from && entry.date <= today);
}

export const CHART_RANGES = ['12w', '6mo', '1y', 'all'] as const;

export type ChartRange = (typeof CHART_RANGES)[number];

export function isChartRange(value: unknown): value is ChartRange {
	return CHART_RANGES.some((range) => range === value);
}

// Fixed-length viewports, deliberately not calendar-exact months.
const RANGE_DAYS: Record<ChartRange, number | null> = {
	'12w': 84,
	'6mo': 183,
	'1y': 365,
	all: null
};

export function rangeStart(entries: BodyweightEntry[], today: string, range: ChartRange): string {
	const days = RANGE_DAYS[range];

	if (days !== null) {
		return addDays(today, -(days - 1));
	}

	const first = entries.at(0);

	return first === undefined ? today : first.date;
}

export function inRange(
	entries: BodyweightEntry[],
	today: string,
	range: ChartRange
): BodyweightEntry[] {
	const from = rangeStart(entries, today, range);

	return entries.filter((entry) => entry.date >= from && entry.date <= today);
}

// `change` compares averages against the previous group that has entries,
// not the previous calendar month — skipped months are not a null.
export type MonthGroup = {
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
