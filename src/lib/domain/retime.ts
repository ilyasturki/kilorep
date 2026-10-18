export type Span = { startedAt: number; finishedAt: number };

export type Retiming = {
	/** `YYYY-MM-DD`, read on the device's own clock. */
	date?: string;
	/** `HH:MM` on a 24-hour clock. */
	time?: string;
	minutes?: number;
};

function pad(value: number): string {
	return String(value).padStart(2, '0');
}

export function timeOf(at: number): string {
	const when = new Date(at);

	return `${pad(when.getHours())}:${pad(when.getMinutes())}`;
}

// From components, not midnight plus hours: that reads 13:00 for noon when the clocks go forward.
export function momentOf(date: string, time: string): number {
	const [year, month, day] = date.split('-').map(Number);
	const [hours, minutes] = time.split(':').map(Number);

	return new Date(year, month - 1, day, hours, minutes).getTime();
}

/** How long it took, or 0 where the record never said: an imported end can be missing or early. */
export function lastedOf(span: Span): number {
	const lasted = span.finishedAt - span.startedAt;

	return Number.isFinite(lasted) && lasted > 0 ? lasted : 0;
}

export function retime(span: Span, to: Retiming): Span {
	const lasted = to.minutes === undefined ? lastedOf(span) : to.minutes * 60_000;

	if (to.date === undefined && to.time === undefined) {
		return { startedAt: span.startedAt, finishedAt: span.startedAt + lasted };
	}

	const from = new Date(span.startedAt);

	const [year, month, day] =
		to.date === undefined
			? [from.getFullYear(), from.getMonth() + 1, from.getDate()]
			: to.date.split('-').map(Number);

	const [hours, minutes, seconds, ms] =
		to.time === undefined
			? [from.getHours(), from.getMinutes(), from.getSeconds(), from.getMilliseconds()]
			: [...to.time.split(':').map(Number), 0, 0];

	const startedAt = new Date(year, month - 1, day, hours, minutes, seconds, ms).getTime();

	return { startedAt, finishedAt: startedAt + lasted };
}
