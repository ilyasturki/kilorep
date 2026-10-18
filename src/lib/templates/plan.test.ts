import { describe, expect, test } from 'vitest';

import { catalogById } from '$lib/catalog';
import { DEFAULT_REST_SECONDS, MAX_REST_SECONDS, defaultRestSettings } from '$lib/domain/rest';
import {
	entryRest,
	planDefaultRest,
	planLine,
	planShape,
	planSummary,
	rotationLine,
	roundsLabel,
	steppedRest,
	targetNote,
	templateTitle
} from '$lib/templates/plan';
import type { Planned, PlanRest } from '$lib/templates/plan';
import type { Exercise } from '$lib/domain/exercise';
import type { Template, TemplateExercise } from '$lib/domain/template';

function planned(targets: (number | null)[]): TemplateExercise {
	return {
		id: 'node',
		exerciseId: 'bench-press',
		sets: targets.map((plannedReps, i) => ({ id: `set-${i + 1}`, plannedReps }))
	};
}

function namedPlan(id: string, name: string): Template {
	return { id, name, createdAt: 0, entries: [] };
}

describe('what an exercise prescribes', () => {
	test('nothing on any set is open, and the shared arm has somewhere to start', () => {
		const shape = planShape(planned([null, null, null]));

		expect(shape).toEqual({ sets: 3, kind: 'open', target: 'Open', reps: null });
		expect(targetNote(shape)).toBe('Open target');
	});

	test('one number on every set is the shared target', () => {
		const shape = planShape(planned([8, 8, 8]));

		expect(shape).toEqual({ sets: 3, kind: 'fixed', target: '8', reps: 8 });
		expect(targetNote(shape)).toBeNull();
	});

	test('numbers that disagree are spelled as their ends', () => {
		const shape = planShape(planned([12, 10, 8]));

		expect(shape).toEqual({ sets: 3, kind: 'range', target: '8–12', reps: null });
		expect(targetNote(shape)).toBe('8–12 per set');
	});

	test('numbers beside an open set are mixed, never a range', () => {
		const shape = planShape(planned([12, null, 8]));

		expect(shape.kind).toBe('mixed');
		expect(shape.target).toBe('Mixed');
		expect(targetNote(shape)).toBe('Targets differ per set');
	});

	test('only a settled target hands the shared stepper a number to step from', () => {
		expect(planShape(planned([8, 8])).reps).toBe(8);
		expect(planShape(planned([8, 10])).reps).toBeNull();
		expect(planShape(planned([8, null])).reps).toBeNull();
		expect(planShape(planned([null])).reps).toBeNull();
	});

	test('the sidebar summary is the shape in one glance', () => {
		expect(planSummary(planned([8, 8, 8]))).toBe('3 × 8');
		expect(planSummary(planned([12, 10, 8]))).toBe('3 × 8–12');
		expect(planSummary(planned([null]))).toBe('1 × Open');
	});
});

function named(id: string, name: string): Exercise {
	return {
		id,
		name,
		aliases: [],
		equipment: 'Barbell',
		loadMode: 'total',
		muscles: { primary: 'Chest', secondary: [] }
	};
}

const catalog = {
	'bench-press': named('bench-press', 'Bench Press'),
	'incline-bench-press': named('incline-bench-press', 'Incline Bench Press'),
	'cable-fly': named('cable-fly', 'Cable Fly'),
	'lateral-raise': named('lateral-raise', 'Lateral Raise')
};

function shaped(entries: string[][]): Template {
	return {
		id: 't1',
		name: 'Push day',
		createdAt: 0,
		entries: entries.map((legs, at) => ({
			id: `entry-${at}`,
			exercises: legs.map((exerciseId) => ({
				id: `${exerciseId}-node`,
				exerciseId,
				sets: [{ id: `${exerciseId}-set`, plannedReps: 8 }]
			}))
		}))
	};
}

describe('what a template says about itself in a list', () => {
	test('a plan short enough names all of itself', () => {
		expect(planLine(shaped([['bench-press'], ['cable-fly']]), catalog)).toBe(
			'Bench Press · Cable Fly'
		);
	});

	test('past two, the rest is counted rather than truncated away', () => {
		const template = shaped([['bench-press'], ['cable-fly'], ['lateral-raise']]);

		expect(planLine(template, catalog)).toBe('Bench Press · Cable Fly +1 more');
	});

	test('a superset is one item, under the name the editor gives it', () => {
		const template = shaped([['bench-press', 'cable-fly'], ['lateral-raise']]);

		expect(planLine(template, catalog)).toBe('Bench Press + Cable Fly · Lateral Raise');
	});

	test('the count is of entries, so a superset is not counted twice', () => {
		const template = shaped([
			['bench-press'],
			['incline-bench-press'],
			['cable-fly', 'lateral-raise']
		]);

		expect(planLine(template, catalog)).toBe('Bench Press · Incline Bench Press +1 more');
	});

	test('an empty plan says so rather than printing nothing', () => {
		expect(planLine(shaped([]), catalog)).toBe('No exercises yet');
	});

	test('a plan keeps the name it was given', () => {
		expect(templateTitle(shaped([['bench-press']]))).toBe('Push day');
	});

	test('a nameless plan reads Untitled, whitespace included', () => {
		const plan = shaped([['bench-press']]);

		plan.name = '';
		expect(templateTitle(plan)).toBe('Untitled');

		plan.name = '   ';
		expect(templateTitle(plan)).toBe('Untitled');
	});

	test('an entry the catalog no longer knows is dropped, not printed blank', () => {
		const template = shaped([['gone'], ['bench-press'], ['cable-fly']]);

		expect(planLine(template, catalog)).toBe('Bench Press · Cable Fly');
	});
});

describe('rotationLine', () => {
	const push = namedPlan('push', 'Push A');
	const pull = namedPlan('pull', 'Pull A');

	test('names the plan the rotation stepped off', () => {
		expect(rotationLine({ plan: pull, after: push })).toBe('after Push A');
	});

	test('calls an untrained rotation a start rather than a step off nothing', () => {
		expect(rotationLine({ plan: push, after: null })).toBe('first in your rotation');
	});

	test('a rotation of one says again — after itself is true and reads as a bug', () => {
		expect(rotationLine({ plan: push, after: push })).toBe('again');
	});

	test('a nameless anchor is named the way every other screen names it', () => {
		expect(rotationLine({ plan: pull, after: namedPlan('blank', '  ') })).toBe('after Untitled');
	});
});

function leg(exerciseId: string, restSeconds?: number | null): Planned {
	const exercise: TemplateExercise = { id: `${exerciseId}-node`, exerciseId, sets: [] };

	if (restSeconds !== undefined) {
		exercise.restSeconds = restSeconds;
	}

	return { id: exercise.id, meta: catalogById[exerciseId], exercise };
}

function stated(seconds: number | null): PlanRest {
	return { seconds, stated: true, fallback: 120 };
}

describe('rest as a plan shows it', () => {
	const settings = Object.assign(defaultRestSettings(), { overrides: { squat: 240 } });

	test('an exercise the plan is silent on reads faint, at what it inherits', () => {
		expect(entryRest([leg('bench-press')], settings, 90)).toEqual({
			seconds: 90,
			stated: false,
			fallback: 90
		});
		expect(entryRest([leg('squat')], settings, 90)).toMatchObject({ seconds: 240, stated: false });
	});

	test('a stated rest reads in ink, off included', () => {
		expect(entryRest([leg('bench-press', 150)], settings)).toEqual({
			seconds: 150,
			stated: true,
			fallback: DEFAULT_REST_SECONDS
		});
		expect(entryRest([leg('bench-press', null)], settings, 90)).toMatchObject({
			seconds: null,
			stated: true
		});
	});

	test('a superset reads its one rest off the leg that closes the round', () => {
		expect(entryRest([leg('bench-press', 300), leg('cable-fly', 60)], settings, 90)).toMatchObject({
			seconds: 60
		});
	});

	test("the plan's default inherits from Settings until it says otherwise", () => {
		expect(planDefaultRest(undefined, settings)).toEqual({
			seconds: DEFAULT_REST_SECONDS,
			stated: false,
			fallback: DEFAULT_REST_SECONDS
		});
		expect(planDefaultRest(null, settings)).toMatchObject({ seconds: null, stated: true });
	});

	test('the arms step by the ladder, and off is the rung under the shortest', () => {
		expect(steppedRest(stated(120), 1, 120)).toBe(135);
		expect(steppedRest(stated(15), -1, 120)).toBeNull();
		expect(steppedRest(stated(null), -1, 120)).toBeNull();
		expect(steppedRest(stated(MAX_REST_SECONDS), 1, 120)).toBe(MAX_REST_SECONDS);
	});

	test('plus out of off lands where the rest would be without it', () => {
		expect(steppedRest({ seconds: null, stated: true, fallback: 90 }, 1, 120)).toBe(90);
		expect(steppedRest({ seconds: null, stated: false, fallback: null }, 1, 120)).toBe(120);
	});
});

describe('roundsLabel', () => {
	function sets(exerciseId: string, count: number): Planned {
		const lifted = leg(exerciseId);

		lifted.exercise.sets = Array.from({ length: count }, (_, i) => ({
			id: `${exerciseId}-${i}`,
			plannedReps: null
		}));

		return lifted;
	}

	test('a ragged superset runs as many rounds as its longest leg', () => {
		expect(roundsLabel([sets('bench-press', 3), sets('cable-fly', 4)])).toBe('4 rounds');
	});

	test('one round is said once', () => {
		expect(roundsLabel([sets('bench-press', 1), sets('cable-fly', 1)])).toBe('1 round');
	});
});
