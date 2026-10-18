import { beforeEach, describe, expect, test, vi } from 'vitest';

import { cancelRestEnd, scheduleRestEnd } from '$lib/notify/rest';
import type { RestState } from '$lib/store/store';
import { tapAlarm } from '$lib/ui/feedback';

import { restTimer } from './rest.svelte.ts';

const saveRest = vi.hoisted(() => vi.fn<(state: RestState) => Promise<void>>());

vi.mock('$lib/store/store', () => ({ getStore: vi.fn().mockResolvedValue({ saveRest }) }));

vi.mock('$lib/notify/rest', () => ({ scheduleRestEnd: vi.fn(), cancelRestEnd: vi.fn() }));

vi.mock('$lib/ui/feedback', () => ({ tapAlarm: vi.fn() }));

const BENCH = { exerciseId: 'bench-press', seconds: 120, name: 'Bench Press' };

beforeEach(() => {
	restTimer.reset();

	vi.clearAllMocks();
});

describe('start', () => {
	test('counts down from the earned duration and says who it is for', () => {
		restTimer.start(BENCH, 1000);

		expect(restTimer.running).toBe(true);
		expect(restTimer.endsAt).toBe(121_000);
		expect(restTimer.label).toBe('2:00');
		expect(restTimer.name).toBe('Bench Press');
		expect(scheduleRestEnd).toHaveBeenCalledWith(121_000, 'Bench Press, next set up.');
	});

	test('a new rest replaces a dismissed one', () => {
		restTimer.start(BENCH, 1000);
		restTimer.skip(2000);
		restTimer.start({ exerciseId: 'row', seconds: 90 }, 5000);

		expect(restTimer.dismissed).toBeNull();
		expect(restTimer.exerciseId).toBe('row');
		expect(scheduleRestEnd).toHaveBeenLastCalledWith(95_000, 'Next set up.');
	});
});

describe('nudge', () => {
	test('moves the end and reschedules the notification', () => {
		restTimer.start(BENCH, 1000);
		restTimer.nudge(30, 2000);

		expect(restTimer.endsAt).toBe(151_000);
		expect(scheduleRestEnd).toHaveBeenLastCalledWith(151_000, 'Bench Press, next set up.');
	});

	test('a cut past zero ends the rest now and withdraws the notification', () => {
		restTimer.start(BENCH, 1000);
		restTimer.nudge(-30, 100_000);

		expect(restTimer.endsAt).toBe(100_000);
		expect(restTimer.overtime).toBe(true);
		expect(cancelRestEnd).toHaveBeenCalled();
		expect(scheduleRestEnd).toHaveBeenCalledTimes(1);
	});
});

describe('skip and bring back', () => {
	test('skip sets the running rest aside whole', () => {
		restTimer.start(BENCH, 1000);
		restTimer.skip(30_000);

		expect(restTimer.running).toBe(false);
		expect(restTimer.dismissed).toEqual({
			endsAt: 121_000,
			seconds: 120,
			exerciseId: 'bench-press',
			name: 'Bench Press'
		});
		expect(cancelRestEnd).toHaveBeenCalled();
	});

	test('bringing it back keeps the same end, as if it had never been skipped', () => {
		restTimer.start(BENCH, 1000);
		restTimer.skip(30_000);
		restTimer.bringBack(60_000);

		expect(restTimer.dismissed).toBeNull();
		expect(restTimer.endsAt).toBe(121_000);
		expect(restTimer.label).toBe('1:01');
		expect(scheduleRestEnd).toHaveBeenLastCalledWith(121_000, 'Bench Press, next set up.');
	});

	test('brought back past its end, it counts up and schedules nothing', () => {
		restTimer.start(BENCH, 1000);
		restTimer.skip(30_000);
		restTimer.bringBack(131_000);

		expect(restTimer.label).toBe('+0:10');
		expect(restTimer.overtime).toBe(true);
		expect(scheduleRestEnd).toHaveBeenCalledTimes(1);
	});

	test('brought back past its end, it does not buzz for a zero long gone', () => {
		restTimer.start(BENCH, 1000);
		restTimer.skip(30_000);
		restTimer.bringBack(121_500);
		restTimer.tick(121_600);

		expect(tapAlarm).not.toHaveBeenCalled();
	});

	test('skipping with nothing running sets nothing aside', () => {
		restTimer.skip(1000);

		expect(restTimer.dismissed).toBeNull();
	});

	test('clear forgets the dismissed rest too', () => {
		restTimer.start(BENCH, 1000);
		restTimer.skip(2000);
		restTimer.clear();

		expect(restTimer.dismissed).toBeNull();
	});
});

describe('mute', () => {
	test('stops the running rest and keeps it to bring back', () => {
		restTimer.start(BENCH, 1000);
		restTimer.mute(2000);

		expect(restTimer.muted).toBe(true);
		expect(restTimer.running).toBe(false);
		expect(restTimer.dismissed).toMatchObject({ endsAt: 121_000 });
		expect(cancelRestEnd).toHaveBeenCalled();
	});

	test('a set logged while muted earns its rest silently', () => {
		restTimer.mute(1000);
		restTimer.start(BENCH, 5000);

		expect(restTimer.running).toBe(false);
		expect(restTimer.dismissed).toMatchObject({ endsAt: 125_000 });
		expect(scheduleRestEnd).not.toHaveBeenCalled();
	});

	test('a muted timer cannot be brought back', () => {
		restTimer.start(BENCH, 1000);
		restTimer.mute(2000);
		restTimer.bringBack(3000);

		expect(restTimer.running).toBe(false);
	});
});

describe('unmute', () => {
	test('brings back the rest the mute set aside', () => {
		restTimer.start(BENCH, 1000);
		restTimer.mute(2000);
		restTimer.unmute(10_000);

		expect(restTimer.muted).toBe(false);
		expect(restTimer.endsAt).toBe(121_000);
		expect(restTimer.dismissed).toBeNull();
		expect(scheduleRestEnd).toHaveBeenLastCalledWith(121_000, 'Bench Press, next set up.');
	});

	test('with nothing set aside, rest is simply on again', () => {
		restTimer.mute(1000);
		restTimer.unmute(2000);

		expect(restTimer.muted).toBe(false);
		expect(restTimer.running).toBe(false);

		restTimer.start(BENCH, 3000);

		expect(restTimer.running).toBe(true);
	});
});

describe('persist and resume', () => {
	test('every change is written down: running, muted and dismissed', async () => {
		const rest = { endsAt: 121_000, seconds: 120, exerciseId: 'bench-press', name: 'Bench Press' };

		restTimer.start(BENCH, 1000);

		await vi.waitFor(() => {
			expect(saveRest).toHaveBeenLastCalledWith({ rest, muted: false, dismissed: null });
		});

		restTimer.skip(2000);

		await vi.waitFor(() => {
			expect(saveRest).toHaveBeenLastCalledWith({ rest: null, muted: false, dismissed: rest });
		});

		restTimer.mute(3000);

		await vi.waitFor(() => {
			expect(saveRest).toHaveBeenLastCalledWith({ rest: null, muted: true, dismissed: rest });
		});
	});

	test('a skipped rest survives a reload and still comes back', () => {
		const dismissed = { endsAt: 121_000, seconds: 120, exerciseId: 'bench-press' };

		restTimer.resume(null, false, dismissed);
		restTimer.bringBack(100_000);

		expect(restTimer.endsAt).toBe(121_000);
		expect(restTimer.label).toBe('0:21');
	});

	test('a running rest resumes on its own end and never buzzes for it', () => {
		restTimer.resume({ endsAt: 1000, seconds: 60, exerciseId: 'bench-press' }, false, null);
		restTimer.tick(1200);

		expect(restTimer.running).toBe(true);
		expect(tapAlarm).not.toHaveBeenCalled();
	});

	test('a muted session resumes muted', () => {
		restTimer.resume(null, true, null);

		expect(restTimer.muted).toBe(true);
	});
});

describe('alarm', () => {
	test('buzzes once at zero', () => {
		restTimer.start(BENCH, 0);
		restTimer.tick(119_750);
		restTimer.tick(120_100);
		restTimer.tick(120_350);

		expect(tapAlarm).toHaveBeenCalledTimes(1);
	});

	test('a tick that slept through zero leaves it to the notification', () => {
		restTimer.start(BENCH, 0);
		restTimer.tick(125_000);

		expect(tapAlarm).not.toHaveBeenCalled();
	});

	test('a nudge back above zero arms it again', () => {
		restTimer.start(BENCH, 0);
		restTimer.tick(120_100);
		restTimer.nudge(30, 121_000);
		restTimer.tick(150_100);

		expect(tapAlarm).toHaveBeenCalledTimes(2);
	});
});
