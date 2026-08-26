import { describe, expect, test } from 'vitest';

import { freshWorkout } from '$lib/domain/fixture';
import {
	DEFAULT_REST_SECONDS,
	MAX_REST_SECONDS,
	MIN_REST_SECONDS,
	closesRound,
	defaultRestSettings,
	nudgedEnd,
	parseRestDraft,
	restAfter,
	restDraft,
	restLabel,
	restProgress,
	restSecondsFor,
	restSecondsOf,
	settleRestSeconds,
	snapRestSeconds
} from '$lib/domain/rest';
import type { RestSettings } from '$lib/domain/rest';
import { commitSet, markSet, supersetWith } from '$lib/domain/workout';
import type { Workout } from '$lib/domain/workout';

function settings(over: Partial<RestSettings> = {}): RestSettings {
	return Object.assign(defaultRestSettings(), over);
}

function logged(setId: string): Workout {
	const workout = freshWorkout(0);

	commitSet(workout, setId, 80, 8);

	return workout;
}

function planned(workout: Workout, node: string, seconds: number | null): Workout {
	const exercise = workout.entries
		.flatMap((entry) => entry.exercises)
		.find((candidate) => candidate.id === node);

	if (exercise !== undefined) {
		exercise.restSeconds = seconds;
	}

	return workout;
}

// An exercise the fixture does not already hold: `supersetWith` would relocate a
// standing one into the entry instead of adding, leaving these ids unused.
function paired(): Workout {
	const workout = freshWorkout(0);

	supersetWith(workout, 'entry-1', 'lateral-raise', {
		exercise: 'we-super',
		sets: ['super-1', 'super-2', 'super-3']
	});

	return workout;
}

describe('restSecondsFor', () => {
	test('an exercise with no override rests for the default', () => {
		expect(restSecondsFor('bench-press', settings())).toBe(DEFAULT_REST_SECONDS);
	});

	test('an override belongs to the entry alone, never to the family', () => {
		const only = settings({ overrides: { 'close-grip-bench-press': 240 } });

		expect(restSecondsFor('close-grip-bench-press', only)).toBe(240);
		expect(restSecondsFor('bench-press', only)).toBe(DEFAULT_REST_SECONDS);
	});

	test('an explicit null is never-rest, which absent is not', () => {
		expect(restSecondsFor('cable-fly', settings({ overrides: { 'cable-fly': null } }))).toBeNull();
		expect(restSecondsFor('cable-fly', settings({ overrides: {} }))).toBe(DEFAULT_REST_SECONDS);
	});
});

describe('restSecondsOf', () => {
	test('no planned duration falls through to the exercise, then to the default', () => {
		expect(restSecondsOf({ exerciseId: 'bench-press' }, settings())).toBe(DEFAULT_REST_SECONDS);

		expect(
			restSecondsOf({ exerciseId: 'bench-press' }, settings({ overrides: { 'bench-press': 240 } }))
		).toBe(240);
	});

	test("the plan outranks the exercise's own duration", () => {
		const over = settings({ overrides: { 'bench-press': 240 } });

		expect(restSecondsOf({ exerciseId: 'bench-press', restSeconds: 90 }, over)).toBe(90);
	});

	test('a planned null is never-rest even where the exercise rests', () => {
		expect(restSecondsOf({ exerciseId: 'bench-press', restSeconds: null }, settings())).toBeNull();
	});

	test('a planned number rests an exercise the settings never rest', () => {
		const never = settings({ overrides: { 'bench-press': null } });

		expect(restSecondsOf({ exerciseId: 'bench-press', restSeconds: 90 }, never)).toBe(90);
	});
});

describe('restAfter', () => {
	test('a committed working set earns a rest', () => {
		expect(restAfter(logged('bench-1'), 'bench-1', settings())).toEqual({
			exerciseId: 'bench-press',
			seconds: DEFAULT_REST_SECONDS
		});
	});

	test('a warmup earns nothing', () => {
		expect(restAfter(logged('bench-w'), 'bench-w', settings())).toBeNull();
	});

	test('rest switched off in Settings earns nothing anywhere', () => {
		expect(restAfter(logged('bench-1'), 'bench-1', settings({ enabled: false }))).toBeNull();
	});

	test('an exercise set to never rest earns nothing', () => {
		const never = settings({ overrides: { 'bench-press': null } });

		expect(restAfter(logged('bench-1'), 'bench-1', never)).toBeNull();
	});

	test('an uncompleted set earns nothing — a draft is not a lift', () => {
		const workout = logged('bench-1');

		markSet(workout, 'bench-1', false);

		expect(restAfter(workout, 'bench-1', settings())).toBeNull();
	});

	test('a set that is not in the tree earns nothing', () => {
		expect(restAfter(freshWorkout(0), 'no-such-set', settings())).toBeNull();
	});

	test('the last owed set of a session still earns one', () => {
		expect(restAfter(logged('pecdeck-3'), 'pecdeck-3', settings())).not.toBeNull();
	});

	test("a plan's own duration is what the set earns", () => {
		const workout = planned(logged('bench-1'), 'we-bench', 195);

		expect(restAfter(workout, 'bench-1', settings({ overrides: { 'bench-press': 240 } }))).toEqual({
			exerciseId: 'bench-press',
			seconds: 195
		});
	});

	test('an exercise the plan never rests earns nothing', () => {
		const workout = planned(logged('bench-1'), 'we-bench', null);

		expect(restAfter(workout, 'bench-1', settings())).toBeNull();
	});

	test('rest switched off in Settings outranks the plan', () => {
		const workout = planned(logged('bench-1'), 'we-bench', 195);

		expect(restAfter(workout, 'bench-1', settings({ enabled: false }))).toBeNull();
	});
});

describe('supersets rest by the round', () => {
	test('the first leg of a round earns nothing — the next leg is the rest', () => {
		const workout = paired();

		commitSet(workout, 'bench-1', 80, 8);

		expect(restAfter(workout, 'bench-1', settings())).toBeNull();
	});

	test("the leg that closes the round earns one, at the closer's own duration", () => {
		const workout = paired();

		commitSet(workout, 'super-1', 20, 12);

		const over = settings({ overrides: { 'lateral-raise': 45, 'bench-press': 300 } });

		expect(restAfter(workout, 'super-1', over)).toEqual({
			exerciseId: 'lateral-raise',
			seconds: 45
		});
	});

	test('a ragged round is closed by whichever leg still has a set in it', () => {
		const workout = paired();

		commitSet(workout, 'bench-4', 80, 6);

		expect(restAfter(workout, 'bench-4', settings())).toEqual({
			exerciseId: 'bench-press',
			seconds: DEFAULT_REST_SECONDS
		});
	});

	test("a planned pair rests by the closing leg's planned duration", () => {
		const workout = planned(planned(paired(), 'we-bench', 300), 'we-super', 45);

		commitSet(workout, 'super-1', 20, 12);

		expect(restAfter(workout, 'super-1', settings())).toEqual({
			exerciseId: 'lateral-raise',
			seconds: 45
		});
	});

	test('warmups sit outside the rounds entirely', () => {
		expect(closesRound(paired().entries[0], 'bench-w')).toBe(false);
	});

	test('every working set of a lone exercise closes its own round', () => {
		const workout = freshWorkout(0);

		for (const id of ['fly-1', 'fly-2', 'fly-3']) {
			expect(closesRound(workout.entries[2], id)).toBe(true);
		}
	});
});

describe('restLabel', () => {
	test('counts down in minutes and padded seconds', () => {
		expect(restLabel(120_000)).toBe('2:00');
		expect(restLabel(84_000)).toBe('1:24');
		expect(restLabel(9000)).toBe('0:09');
	});

	test('truncates rather than rounds, so the last second is not skipped', () => {
		expect(restLabel(999)).toBe('0:00');
		expect(restLabel(1999)).toBe('0:01');
	});

	test('overtime wears the plus', () => {
		expect(restLabel(-14_000)).toBe('+0:14');
		expect(restLabel(-62_000)).toBe('+1:02');
	});
});

describe('restProgress', () => {
	test('runs from empty to full, and overtime stays full', () => {
		expect(restProgress(1000, 1, 0)).toBe(0);
		expect(restProgress(1000, 1, 500)).toBe(0.5);
		expect(restProgress(1000, 1, 1000)).toBe(1);
		expect(restProgress(1000, 1, 9000)).toBe(1);
	});
});

describe('nudgedEnd', () => {
	test('moves the end by the nudge', () => {
		expect(nudgedEnd(100_000, 30, 0)).toBe(130_000);
		expect(nudgedEnd(100_000, -30, 0)).toBe(70_000);
	});

	test('a cut deeper than what is left ends the rest rather than inventing overtime', () => {
		expect(nudgedEnd(10_000, -30, 0)).toBe(0);
	});

	test('a thumb leaning on plus cannot build an hour', () => {
		expect(nudgedEnd(MAX_REST_SECONDS * 1000, 600, 0)).toBe(MAX_REST_SECONDS * 1000);
	});
});

describe('settleRestSeconds', () => {
	test('clamps to the range both editors offer', () => {
		expect(settleRestSeconds(0)).toBe(MIN_REST_SECONDS);
		expect(settleRestSeconds(9999)).toBe(MAX_REST_SECONDS);
		expect(settleRestSeconds(120.4)).toBe(120);
	});
});

describe('restDraft', () => {
	test('grows the colon as the digits fill from the right', () => {
		expect(restDraft('2')).toBe('0:02');
		expect(restDraft('23')).toBe('0:23');
		expect(restDraft('230')).toBe('2:30');
		expect(restDraft('1000')).toBe('10:00');
	});

	test('a colon typed on a real keyboard says nothing the digits did not', () => {
		expect(restDraft('2:30')).toBe('2:30');
		expect(restDraft('2:3')).toBe('0:23');
	});

	test('leading zeros are typed through rather than kept', () => {
		expect(restDraft('0230')).toBe('2:30');
	});

	test('empties to empty, so a cleared field reads as cleared', () => {
		expect(restDraft('')).toBe('');
	});

	test('refuses the fifth digit rather than dropping the first', () => {
		expect(restDraft('10000')).toBeNull();
	});
});

describe('parseRestDraft', () => {
	test('reads restLabel backwards', () => {
		expect(parseRestDraft('2:30')).toBe(150);
		expect(parseRestDraft('0:09')).toBe(9);
		expect(parseRestDraft('10:00')).toBe(600);
	});

	test('reads the digits alone the same way', () => {
		expect(parseRestDraft('230')).toBe(150);
		expect(parseRestDraft('45')).toBe(45);
	});

	test('a seconds half over a minute counts on rather than clamping', () => {
		expect(parseRestDraft('1:90')).toBe(150);
	});

	test('nothing typed is nothing landed', () => {
		expect(parseRestDraft('')).toBeNull();
		expect(parseRestDraft(':')).toBeNull();
	});
});

describe('snapRestSeconds', () => {
	test('a duration typed between two rungs joins the ladder', () => {
		expect(snapRestSeconds(127)).toBe(120);
		expect(snapRestSeconds(128)).toBe(135);
	});

	test('the rungs themselves do not move', () => {
		expect(snapRestSeconds(150)).toBe(150);
	});

	test('clamps to the range the arms offer', () => {
		expect(snapRestSeconds(5)).toBe(MIN_REST_SECONDS);
		expect(snapRestSeconds(9999)).toBe(MAX_REST_SECONDS);
	});
});
