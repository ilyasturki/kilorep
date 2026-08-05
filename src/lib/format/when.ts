/**
 * The words this app counts recent days in, in one place because two screens
 * say them.
 *
 * History spells a workout's age and the Weight log spells a weigh-in's, and
 * the two arrive at it from different inputs — a millisecond timestamp there, a
 * date-only string here — so they cannot share a formatter. What they must
 * share is the vocabulary: the day the two drift is the day the same Tuesday
 * reads `2d` on one tab and `2 days ago` on the next.
 *
 * `null` is the handover, and it belongs to the caller: how a day too old to
 * count is written down is a question about the surface it is written on.
 * History has a whole row to spend and prints a date; the Weight log sits under
 * a header that already named the month and prints a weekday.
 */
export function countedDays(days: number): string | null {
	if (days < 1) {
		return 'Today';
	}

	if (days === 1) {
		return 'Yesterday';
	}

	// A week is where counting stops answering. `6 days ago` is still a number
	// you feel; `9 days ago` is one you convert to a date anyway.
	return days < 7 ? `${days}d` : null;
}
