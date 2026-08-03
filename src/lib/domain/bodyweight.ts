/**
 * The body-weight domain slice: the entry, the day it belongs to, and the
 * trend math the Weight screen draws.
 *
 * Plain TypeScript with zero framework imports, per CLAUDE.md hard rule 1.
 * PRODUCT.md fixes the whole model in one line — date + kg, one per day,
 * re-logging overwrites — and this module keeps it that small. Its own file
 * rather than a corner of `workout.ts` because SCOPE.md's data-domain rule
 * says a new domain arrives self-contained, and body weight is the first one
 * to arrive after workouts.
 */

/**
 * One weigh-in. `date` is the local calendar day it belongs to, as
 * `YYYY-MM-DD` — the day the person experienced, never a UTC recomputation
 * that files a 7am weigh-in under yesterday. The string is also the identity:
 * see `bodyweightId`.
 */
export type BodyweightEntry = { date: string; kg: number };

/**
 * The record id for a day's entry, and the reason "one per day" needs no
 * enforcement: it is true by construction. Re-logging a day is a put to the
 * same key, and two devices logging the same day mint the same id, so
 * last-write-wins settles them like any other conflict — no dedupe at read,
 * no merge rule, nothing.
 */
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

/** `date` moved by `days`, either direction — the window edges below. */
export function addDays(date: string, days: number): string {
	return new Date((dayNumber(date) + days) * 86_400_000).toISOString().slice(0, 10);
}

/**
 * The trend the chart draws: one point per entry, valued at the mean of every
 * entry within the trailing `windowDays` calendar days. Calendar days and not
 * last-N-entries, so a week of missed weigh-ins does not stretch the window
 * back into a different month's numbers — a gap simply leaves the average
 * resting on fewer points, down to one.
 *
 * Seven by default because daily weight swings on water and meal timing by
 * amounts that dwarf a real week's change; the average is the signal, the raw
 * entries stay visible as dots. Entries must arrive oldest first — the order
 * the store lists them in.
 */
export function rollingAverage(entries: BodyweightEntry[], windowDays = 7): BodyweightEntry[] {
	const out: BodyweightEntry[] = [];

	for (let i = 0; i < entries.length; i++) {
		const from = dayNumber(entries[i].date) - (windowDays - 1);

		let sum = 0;
		let count = 0;

		// Walking back per point rather than keeping a running sum: the window
		// holds at most `windowDays` entries (one per day by construction), so
		// this is bounded work — and a running sum accumulates float drift over
		// a log measured in years.
		for (let j = i; j >= 0 && dayNumber(entries[j].date) >= from; j--) {
			sum += entries[j].kg;
			count++;
		}

		out.push({ date: entries[i].date, kg: sum / count });
	}

	return out;
}

/**
 * The trend's slope as the Dashboard's weight card states it: kilograms per
 * week, signed, read first-point-to-last off whatever slice of the rolling
 * average the caller passes — the average, never the raw entries, for the
 * same reason the chart's line is the signal. Null under fourteen calendar
 * days of span: a weekly rate extrapolated from less than two weeks answers
 * with noise, and the card would rather say "keep logging" than guess.
 */
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
