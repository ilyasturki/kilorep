import { describe, expect, it } from 'vitest';

import { freshWorkout } from '$lib/domain/fixture';
import type { Template } from '$lib/domain/template';
import type { WorkoutSet } from '$lib/domain/workout';
import type { FinishedWorkout } from '$lib/store/derive';

import { bodyweightCsv, csvField, csvNames, setsCsv } from './csv.ts';

const at = (date: string): number => new Date(`${date}T09:00`).getTime();

function done(
	id: string,
	weight: number,
	reps: number,
	extra: Partial<Pick<WorkoutSet, 'type' | 'rpe' | 'grip' | 'arms'>> = {}
): WorkoutSet {
	const set: WorkoutSet = {
		id,
		type: extra.type ?? 'normal',
		plannedReps: null,
		weight,
		reps,
		rpe: extra.rpe ?? null,
		completed: true
	};

	if (extra.grip !== undefined) {
		set.grip = extra.grip;
	}

	if (extra.arms !== undefined) {
		set.arms = extra.arms;
	}

	return set;
}

const lines = (csv: string): string[] => csv.split('\r\n').slice(1, -1);

describe('a CSV field', () => {
	it('is quoted only where RFC 4180 needs it, quotes doubled', () => {
		expect(csvField('Bench Press')).toBe('Bench Press');
		expect(csvField('Push, heavy')).toBe('"Push, heavy"');
		expect(csvField('Push "A"')).toBe('"Push ""A"""');
		expect(csvField('two\nlines')).toBe('"two\nlines"');
		expect(csvField('cr\rhere')).toBe('"cr\rhere"');
		expect(csvField(77.5)).toBe('77.5');
		expect(csvField(null)).toBe('');
	});
});

describe('the sets CSV', () => {
	it('heads every column and ends every row with CRLF', () => {
		const csv = setsCsv([], [], []);

		expect(csv).toBe(
			'date,workout,exercise,set,type,weight_kg,load_mode,reps,rpe,grip,arms,completed,load_kg\r\n'
		);
	});

	it('numbers working sets past the warmups, which take no number', () => {
		const workout: FinishedWorkout = Object.assign(freshWorkout(at('2026-07-20')), {
			finishedAt: at('2026-07-20')
		});

		expect(lines(setsCsv([workout], [], [])).slice(0, 5)).toEqual([
			'2026-07-20,Bench Press + 3 more,Bench Press,,warmup,40,total,10,,Standard,both,true,',
			'2026-07-20,Bench Press + 3 more,Bench Press,1,normal,,total,,,Standard,both,false,',
			'2026-07-20,Bench Press + 3 more,Bench Press,2,normal,,total,,,Standard,both,false,',
			'2026-07-20,Bench Press + 3 more,Bench Press,3,normal,,total,,,Standard,both,false,',
			'2026-07-20,Bench Press + 3 more,Bench Press,4,normal,,total,,,Standard,both,false,'
		]);
	});

	it('interleaves a superset round by round, as it was performed', () => {
		const workout: FinishedWorkout = {
			id: 'ss',
			templateId: null,
			startedAt: at('2026-07-21'),
			finishedAt: at('2026-07-21'),
			entries: [
				{
					id: 'e1',
					exercises: [
						{
							id: 'a',
							exerciseId: 'incline-dumbbell-press',
							sets: [
								done('a0', 12, 10, { type: 'warmup' }),
								done('a1', 30, 10, { rpe: 8 }),
								done('a2', 30, 9, { rpe: 9.5, type: 'failure' })
							]
						},
						{
							id: 'b',
							exerciseId: 'cable-fly',
							sets: [done('b1', 20, 12, { arms: 'one' }), done('b2', 15, 12, { type: 'drop' })]
						}
					]
				}
			]
		};

		expect(lines(setsCsv([workout], [], []))).toEqual([
			'2026-07-21,Incline DB Press + 1 more,Incline DB Press,,warmup,12,per-hand,10,,,both,true,',
			'2026-07-21,Incline DB Press + 1 more,Incline DB Press,1,normal,30,per-hand,10,8,,both,true,',
			'2026-07-21,Incline DB Press + 1 more,Cable Fly,1,normal,20,per-hand,12,,,one,true,',
			'2026-07-21,Incline DB Press + 1 more,Incline DB Press,2,failure,30,per-hand,9,9.5,,both,true,',
			'2026-07-21,Incline DB Press + 1 more,Cable Fly,2,drop,15,per-hand,12,,,both,true,'
		]);
	});

	it('adds the body a set carried, from the weigh-in in force that day', () => {
		const pulls = (id: string, date: string): FinishedWorkout => ({
			id,
			templateId: 'pull',
			startedAt: at(date),
			finishedAt: at(date),
			entries: [
				{
					id: `${id}-e1`,
					exercises: [
						{
							id: `${id}-p`,
							exerciseId: 'pull-up',
							sets: [done(`${id}-1`, 10, 6, { grip: 'underhand' }), done(`${id}-2`, 0, 8)]
						}
					]
				},
				{
					id: `${id}-e2`,
					exercises: [{ id: `${id}-u`, exerciseId: 'push-up', sets: [done(`${id}-3`, 0, 20)] }]
				},
				{
					id: `${id}-e3`,
					exercises: [{ id: `${id}-b`, exerciseId: 'bench-press', sets: [done(`${id}-4`, 80, 5)] }]
				}
			]
		});

		const plan: Template = { id: 'pull', name: 'Pull', createdAt: 0, entries: [] };

		const weighIns = [
			{ date: '2026-07-05', kg: 80 },
			{ date: '2026-07-11', kg: 90 }
		];
		const workouts = [pulls('before', '2026-07-01'), pulls('after', '2026-07-10')];

		expect(lines(setsCsv(workouts, [plan], weighIns))).toEqual([
			'2026-07-01,Pull,Pull-Up,1,normal,10,total,6,,Supinated,both,true,',
			'2026-07-01,Pull,Pull-Up,2,normal,0,total,8,,Pronated,both,true,',
			'2026-07-01,Pull,Push-Up,1,normal,0,total,20,,,both,true,',
			'2026-07-01,Pull,Bench Press,1,normal,80,total,5,,Standard,both,true,',
			'2026-07-10,Pull,Pull-Up,1,normal,10,total,6,,Supinated,both,true,90',
			'2026-07-10,Pull,Pull-Up,2,normal,0,total,8,,Pronated,both,true,80',
			'2026-07-10,Pull,Push-Up,1,normal,0,total,20,,,both,true,52',
			'2026-07-10,Pull,Bench Press,1,normal,80,total,5,,Standard,both,true,'
		]);
	});

	it('quotes a plan name that needs it, and names an exercise the catalog lacks by its id', () => {
		const workout: FinishedWorkout = {
			id: 'q',
			templateId: 'push',
			startedAt: at('2026-07-22'),
			finishedAt: at('2026-07-22'),
			entries: [
				{ id: 'e', exercises: [{ id: 'x', exerciseId: 'my-own-press', sets: [done('s', 50, 8)] }] }
			]
		};
		const plan: Template = { id: 'push', name: 'Push "A", heavy', createdAt: 0, entries: [] };

		expect(lines(setsCsv([workout], [plan], []))).toEqual([
			'2026-07-22,"Push ""A"", heavy",my-own-press,1,normal,50,,8,,,both,true,'
		]);
	});
});

it('leaves blank what a set from an older build never wrote', () => {
	const sparse = { id: 's', reps: 5 } as unknown as WorkoutSet;
	const workout: FinishedWorkout = {
		id: 'old',
		templateId: null,
		startedAt: at('2026-07-23'),
		finishedAt: at('2026-07-23'),
		entries: [{ id: 'e', exercises: [{ id: 'x', exerciseId: 'pull-up', sets: [sparse] }] }]
	};

	expect(lines(setsCsv([workout], [], [{ date: '2026-07-01', kg: 80 }]))).toEqual([
		'2026-07-23,Pull-Up,Pull-Up,1,,,total,5,,Pronated,both,false,'
	]);
});

describe('the body weight CSV', () => {
	it('is a date and a weight per row', () => {
		expect(
			bodyweightCsv([
				{ date: '2026-07-05', kg: 80 },
				{ date: '2026-07-11', kg: 80.4 }
			])
		).toBe('date,kg\r\n2026-07-05,80\r\n2026-07-11,80.4\r\n');
	});
});

it('names both files after the day they were made', () => {
	expect(csvNames(at('2026-07-22'))).toEqual({
		sets: 'kilorep-sets-2026-07-22.csv',
		bodyweight: 'kilorep-bodyweight-2026-07-22.csv'
	});
});
