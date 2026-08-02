/**
 * What the seeded database has to be true of, checked against the same
 * derivations the screens read it through.
 *
 * The generator is data, and data rots quietly: a slug renamed in the catalog,
 * a set left completed with no weight on it, an edge state planted twice and
 * cancelling itself out. None of that fails a build — it fails as a screen that
 * looks subtly wrong weeks later, which is the worst way to find it.
 */

import { describe, expect, it } from 'vitest';

import { catalogById } from '$lib/catalog';
import { driftFrom, hasDrift } from '$lib/domain/drift';
import { rawPr } from '$lib/domain/stats';
import { completedSetCount, workoutTitle } from '$lib/history/label';
import { pastSessionsFrom, performedSets } from '$lib/store/derive';

import { seedContent } from '../scripts/seed/content.ts';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 7, 1, 9, 30);

const content = seedContent(NOW);
const live = content.templates
	.filter((entry) => entry.deletedAt === null)
	.map(({ template }) => template);

function templateNamed(name: string) {
	const found = live.find((template) => template.name === name);

	if (found === undefined) {
		throw new Error(`no live template named ${name}`);
	}

	return found;
}

function sessionsOf(templateId: string) {
	return content.workouts.filter((workout) => workout.templateId === templateId);
}

describe('the seed as data', () => {
	it('names only exercises the catalog still holds', () => {
		const planned = content.templates.flatMap(({ template }) =>
			template.entries.flatMap((entry) => entry.exercises.map((exercise) => exercise.exerciseId))
		);
		const performed = content.workouts.flatMap((workout) =>
			workout.entries.flatMap((entry) => entry.exercises.map((exercise) => exercise.exerciseId))
		);

		for (const exerciseId of [...planned, ...performed]) {
			expect(catalogById[exerciseId], exerciseId).toBeDefined();
		}
	});

	it('mints every id once', () => {
		const ids: string[] = [];

		for (const { template } of content.templates) {
			ids.push(template.id);

			for (const entry of template.entries) {
				ids.push(entry.id);

				for (const exercise of entry.exercises) {
					ids.push(exercise.id, ...exercise.sets.map((set) => set.id));
				}
			}
		}

		for (const workout of content.workouts) {
			ids.push(workout.id);

			for (const entry of workout.entries) {
				ids.push(entry.id);

				for (const exercise of entry.exercises) {
					ids.push(exercise.id, ...exercise.sets.map((set) => set.id));
				}
			}
		}

		expect(new Set(ids).size).toBe(ids.length);
	});

	it('returns the same tree for the same anchor', () => {
		expect(seedContent(NOW)).toStrictEqual(content);
	});
});

describe('the block', () => {
	it('runs oldest first, on training days, ending just before the anchor', () => {
		const starts = content.workouts.map((workout) => workout.startedAt);

		expect(starts).toStrictEqual(starts.toSorted((a, b) => a - b));

		for (const start of starts) {
			expect([1, 3, 5]).toContain(new Date(start).getDay());
		}

		const last = starts.at(-1) ?? 0;

		expect(last).toBeLessThan(NOW);
		// Yesterday, unless yesterday was a rest day — Friday to Monday is the
		// widest the Mon/Wed/Fri grid ever gets.
		expect(NOW - last).toBeLessThan(4 * DAY);
	});

	it('finishes every session after it started', () => {
		for (const workout of content.workouts) {
			expect(workout.finishedAt).toBeGreaterThan(workout.startedAt);
		}
	});

	it('holds eight sessions of each day in the rotation', () => {
		for (const name of ['Push Day', 'Pull Day', 'Leg Day']) {
			expect(sessionsOf(templateNamed(name).id)).toHaveLength(8);
		}
	});
});

describe('the sets', () => {
	it('logs both numbers on a completed set and neither on an unchecked one', () => {
		for (const workout of content.workouts) {
			for (const entry of workout.entries) {
				for (const exercise of entry.exercises) {
					for (const set of exercise.sets) {
						if (set.completed) {
							expect(set.weight, set.id).not.toBeNull();
							expect(set.reps, set.id).not.toBeNull();
						} else {
							expect(set.weight, set.id).toBeNull();
							expect(set.reps, set.id).toBeNull();
						}
					}
				}
			}
		}
	});

	it('leaves exactly one set unchecked, and counts it nowhere', () => {
		const unchecked = content.workouts.flatMap((workout) =>
			workout.entries.flatMap((entry) =>
				entry.exercises.flatMap((exercise) => exercise.sets.filter((set) => !set.completed))
			)
		);

		expect(unchecked).toHaveLength(1);

		const session = content.workouts.find((workout) =>
			workout.entries.some((entry) =>
				entry.exercises.some((exercise) => exercise.sets.includes(unchecked[0]))
			)
		);

		if (session === undefined) {
			throw new Error('the unchecked set belongs to no session');
		}

		const total = session.entries.flatMap((entry) =>
			entry.exercises.flatMap((exercise) => exercise.sets.filter((set) => set.type !== 'warmup'))
		);

		expect(completedSetCount(session)).toBe(total.length - 1);
	});

	it('keeps warmups out of history', () => {
		// The bench warmup is 40 kg and every working set is heavier, so a warmup
		// leaking into `performedSets` shows up as a load that cannot be there.
		const performed = content.workouts.flatMap((workout) => performedSets(workout, 'bench-press'));

		expect(performed.length).toBeGreaterThan(0);

		for (const set of performed) {
			expect(set.weight).toBeGreaterThan(40);
		}
	});
});

describe('the planted states', () => {
	it('sets the bench PR before the last bench session', () => {
		const sessions = pastSessionsFrom(content.workouts, 'bench-press');
		const pr = rawPr(sessions);

		expect(pr).not.toBeNull();
		expect(pr?.set.weight).toBe(82.5);
		expect(pr?.date).not.toBe(sessions.at(-1)?.date);
	});

	it('drifts the last leg day against its plan, and nothing else', () => {
		const legs = templateNamed('Leg Day');
		const sessions = sessionsOf(legs.id);
		const last = sessions.at(-1);

		if (last === undefined) {
			throw new Error('no leg sessions');
		}

		const drift = driftFrom(last, legs);
		const setDrift = Object.values(drift.matched);

		expect(drift.missing).toStrictEqual(['standing-calf-raise']);
		expect(drift.unplanned).toHaveLength(1);
		expect(setDrift.some((entry) => entry.added > 0)).toBe(true);
		expect(setDrift.some((entry) => entry.retargeted > 0)).toBe(true);

		for (const session of sessions.slice(0, -1)) {
			expect(hasDrift(driftFrom(session, legs)), session.id).toBe(false);
		}
	});

	it('plans arms and never trains them', () => {
		const arms = templateNamed('Arms');

		expect(sessionsOf(arms.id)).toHaveLength(0);

		for (const entry of arms.entries) {
			for (const exercise of entry.exercises) {
				expect(
					pastSessionsFrom(content.workouts, exercise.exerciseId),
					exercise.exerciseId
				).toHaveLength(0);
			}
		}
	});

	it('names the orphaned session by its contents', () => {
		const tombstoned = content.templates.find((entry) => entry.deletedAt !== null);

		if (tombstoned === undefined) {
			throw new Error('no tombstoned template');
		}

		const orphan = content.workouts.find(
			(workout) => workout.templateId === tombstoned.template.id
		);

		if (orphan === undefined) {
			throw new Error('the tombstoned template has no session');
		}

		// The live list is what the History screen holds — the tombstone is
		// filtered out of it long before the title is asked for.
		expect(workoutTitle(orphan, live)).toBe('Bench Press + 4 more');
	});
});

describe('the weigh-ins', () => {
	it('runs oldest first, one per day, ending just before the anchor', () => {
		const dates = content.bodyweight.map(({ entry }) => entry.date);

		// ISO dates order lexicographically, which is also what makes them keys.
		expect(dates).toStrictEqual(dates.toSorted());
		expect(new Set(dates).size).toBe(dates.length);

		const last = content.bodyweight.at(-1);

		if (last === undefined) {
			throw new Error('no weigh-ins planted');
		}

		expect(last.loggedAt).toBeLessThan(NOW);
		expect(NOW - last.loggedAt).toBeLessThan(2 * DAY);
	});

	it('misses days the way a real log does', () => {
		// Sixty calendar days, minus the Sundays and one weekend away: the trend
		// must render gaps, and a log with an entry every single day tests none.
		expect(content.bodyweight.length).toBeGreaterThan(40);
		expect(content.bodyweight.length).toBeLessThan(60);
	});

	it('stays inside a plausible human range, one decimal at most', () => {
		for (const { entry } of content.bodyweight) {
			expect(entry.kg).toBeGreaterThan(75);
			expect(entry.kg).toBeLessThan(90);
			expect(Math.round(entry.kg * 10) / 10).toBe(entry.kg);
		}
	});
});
