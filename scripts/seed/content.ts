import type { BodyweightEntry } from '../../src/lib/domain/bodyweight.ts';
import { localDateOf } from '../../src/lib/domain/bodyweight.ts';
import type { Template, TemplateEntry } from '../../src/lib/domain/template.ts';
import type {
	Workout,
	WorkoutEntry,
	WorkoutExercise,
	WorkoutSet
} from '../../src/lib/domain/workout.ts';
import type { FinishedWorkout } from '../../src/lib/store/derive.ts';

type PlannedExercise = {
	exerciseId: string;
	sets: number;
	plannedReps: number | null;
	performedReps: number;
	start: number;
	step: number;
	warmup?: number;
};

type Plan = {
	id: string;
	name: string;
	exercises: PlannedExercise[];
};

const PUSH: Plan = {
	id: 'seed-template-push',
	name: 'Push Day',
	exercises: [
		{
			exerciseId: 'bench-press',
			sets: 4,
			plannedReps: 8,
			performedReps: 8,
			start: 70,
			step: 2.5,
			warmup: 40
		},
		{
			exerciseId: 'overhead-press',
			sets: 3,
			plannedReps: 8,
			performedReps: 8,
			start: 42.5,
			step: 2.5,
			warmup: 25
		},
		{
			exerciseId: 'incline-dumbbell-press',
			sets: 3,
			plannedReps: null,
			performedReps: 10,
			start: 24,
			step: 2
		},
		{
			exerciseId: 'lateral-raise',
			sets: 3,
			plannedReps: 12,
			performedReps: 12,
			start: 10,
			step: 1
		},
		{
			exerciseId: 'triceps-pushdown',
			sets: 3,
			plannedReps: 12,
			performedReps: 12,
			start: 20,
			step: 2.5
		}
	]
};

const PULL: Plan = {
	id: 'seed-template-pull',
	name: 'Pull Day',
	exercises: [
		{
			exerciseId: 'deadlift',
			sets: 3,
			plannedReps: 5,
			performedReps: 5,
			start: 115,
			step: 2.5,
			warmup: 60
		},
		{ exerciseId: 'pull-up', sets: 3, plannedReps: 8, performedReps: 8, start: 2.5, step: 2.5 },
		{
			exerciseId: 'seated-cable-row',
			sets: 3,
			plannedReps: 10,
			performedReps: 10,
			start: 52.5,
			step: 2.5
		},
		{
			exerciseId: 'face-pull',
			sets: 3,
			plannedReps: 15,
			performedReps: 15,
			start: 12.5,
			step: 2.5
		},
		{ exerciseId: 'hammer-curl', sets: 3, plannedReps: 10, performedReps: 10, start: 10, step: 2 }
	]
};

const LEGS: Plan = {
	id: 'seed-template-legs',
	name: 'Leg Day',
	exercises: [
		{
			exerciseId: 'squat',
			sets: 4,
			plannedReps: 6,
			performedReps: 6,
			start: 95,
			step: 2.5,
			warmup: 60
		},
		{
			exerciseId: 'romanian-deadlift',
			sets: 3,
			plannedReps: 8,
			performedReps: 8,
			start: 75,
			step: 5
		},
		{ exerciseId: 'leg-press', sets: 3, plannedReps: 10, performedReps: 10, start: 130, step: 5 },
		{ exerciseId: 'leg-curl', sets: 3, plannedReps: 12, performedReps: 12, start: 35, step: 2.5 },
		{
			exerciseId: 'standing-calf-raise',
			sets: 3,
			plannedReps: 15,
			performedReps: 15,
			start: 40,
			step: 2.5
		}
	]
};

const ARMS: Plan = {
	id: 'seed-template-arms',
	name: 'Arms',
	exercises: [
		{
			exerciseId: 'barbell-curl',
			sets: 3,
			plannedReps: 10,
			performedReps: 10,
			start: 30,
			step: 2.5
		},
		{
			exerciseId: 'preacher-curl',
			sets: 3,
			plannedReps: 12,
			performedReps: 12,
			start: 25,
			step: 2.5
		},
		{
			exerciseId: 'skull-crusher',
			sets: 3,
			plannedReps: 10,
			performedReps: 10,
			start: 30,
			step: 2.5
		},
		{
			exerciseId: 'overhead-triceps-extension',
			sets: 3,
			plannedReps: 12,
			performedReps: 12,
			start: 25,
			step: 2.5
		}
	]
};

const UPPER: Plan = {
	id: 'seed-template-upper',
	name: 'Upper Body',
	exercises: [
		{
			exerciseId: 'bench-press',
			sets: 3,
			plannedReps: 8,
			performedReps: 8,
			start: 67.5,
			step: 2.5,
			warmup: 40
		},
		{
			exerciseId: 'barbell-row',
			sets: 3,
			plannedReps: 10,
			performedReps: 10,
			start: 55,
			step: 2.5
		},
		{
			exerciseId: 'lat-pulldown',
			sets: 3,
			plannedReps: 10,
			performedReps: 10,
			start: 60,
			step: 2.5
		},
		{
			exerciseId: 'overhead-press',
			sets: 3,
			plannedReps: 8,
			performedReps: 8,
			start: 40,
			step: 2.5
		},
		{
			exerciseId: 'dumbbell-curl',
			sets: 3,
			plannedReps: 10,
			performedReps: 10,
			start: 12,
			step: 2
		}
	]
};

const ROTATION = [PUSH, PULL, LEGS];

const BLOCK = 24;

const TRAINING_WEEKDAYS = new Set([1, 3, 5]);

const START_HOUR = 18;
const START_MINUTE = 30;

const MINUTE = 60_000;
const DAY = 86_400_000;

const DURATIONS: Record<string, number> = {
	[PUSH.id]: 62,
	[PULL.id]: 68,
	[LEGS.id]: 71,
	[UPPER.id]: 74
};

function trainingDays(now: number, count: number): number[] {
	const days: number[] = [];
	const cursor = new Date(now);

	cursor.setHours(START_HOUR, START_MINUTE, 0, 0);
	cursor.setDate(cursor.getDate() - 1);

	while (days.length < count) {
		if (TRAINING_WEEKDAYS.has(cursor.getDay())) {
			days.push(cursor.getTime());
		}

		cursor.setDate(cursor.getDate() - 1);
	}

	return days.toReversed();
}

function loadFor(exercise: PlannedExercise, sessionIndex: number): number {
	return exercise.start + exercise.step * Math.floor(sessionIndex / 2);
}

function weightFor(exercise: PlannedExercise, sessionIndex: number, setIndex: number): number {
	const load = loadFor(exercise, sessionIndex);

	return setIndex === exercise.sets - 1 && load - exercise.step > 0 ? load - exercise.step : load;
}

function repsFor(exercise: PlannedExercise, sessionIndex: number, setIndex: number): number {
	const base = setIndex < 2 ? exercise.performedReps : exercise.performedReps - 1;
	const goodDay = sessionIndex % 3 === 2 && setIndex === 0;

	return goodDay ? base + 1 : base;
}

function exertionFor(
	exercise: PlannedExercise,
	sessionIndex: number,
	setIndex: number
): number | null {
	if (setIndex !== exercise.sets - 1) {
		return null;
	}

	return Math.min(9.5, 8 + Math.floor(sessionIndex / 2) * 0.5);
}

function workingSet(
	id: string,
	exercise: PlannedExercise,
	sessionIndex: number,
	setIndex: number
): WorkoutSet {
	return {
		id,
		type: 'normal',
		plannedReps: exercise.plannedReps,
		weight: weightFor(exercise, sessionIndex, setIndex),
		reps: repsFor(exercise, sessionIndex, setIndex),
		rpe: exertionFor(exercise, sessionIndex, setIndex),
		completed: true
	};
}

function templateOf(plan: Plan, createdAt: number): Template {
	const entries: TemplateEntry[] = plan.exercises.map((exercise, index) => ({
		id: `${plan.id}-e${index + 1}`,
		exercises: [
			{
				id: `${plan.id}-x${index + 1}`,
				exerciseId: exercise.exerciseId,
				sets: Array.from({ length: exercise.sets }, (_, setIndex) => ({
					id: `${plan.id}-x${index + 1}-s${setIndex + 1}`,
					plannedReps: exercise.plannedReps
				}))
			}
		]
	}));

	return { id: plan.id, name: plan.name, createdAt, entries };
}

// `sessionIndex` counts this plan's own sessions, not the block's.
function workoutOf(plan: Plan, id: string, startedAt: number, sessionIndex: number): Workout {
	const entries: WorkoutEntry[] = plan.exercises.map((exercise, index) => {
		const node = `${id}-x${index + 1}`;
		const sets: WorkoutSet[] = [];

		if (exercise.warmup !== undefined) {
			sets.push({
				id: `${node}-w`,
				type: 'warmup',
				plannedReps: null,
				weight: exercise.warmup,
				reps: 10,
				rpe: null,
				completed: true
			});
		}

		for (let setIndex = 0; setIndex < exercise.sets; setIndex += 1) {
			sets.push(workingSet(`${node}-s${setIndex + 1}`, exercise, sessionIndex, setIndex));
		}

		return {
			id: `${id}-e${index + 1}`,
			exercises: [{ id: node, exerciseId: exercise.exerciseId, sets }]
		};
	});

	return { id, templateId: plan.id, startedAt, entries };
}

function nodeFor(workout: Workout, exerciseId: string): WorkoutExercise | undefined {
	return workout.entries
		.flatMap((entry) => entry.exercises)
		.find((node) => node.exerciseId === exerciseId);
}

function plantPr(workout: Workout): void {
	const node = nodeFor(workout, 'bench-press');

	if (node === undefined) {
		return;
	}

	const top = node.sets.find((set) => set.type === 'normal');

	if (top !== undefined) {
		top.weight = 82.5;
		top.reps = 3;
	}
}

function plantSkippedSet(workout: Workout): void {
	const node = nodeFor(workout, 'triceps-pushdown');

	if (node === undefined) {
		return;
	}

	const last = node.sets.at(-1);

	if (last !== undefined) {
		last.weight = null;
		last.reps = null;
		last.completed = false;
	}
}

function plantDrift(workout: Workout): void {
	const press = nodeFor(workout, 'leg-press');

	if (press !== undefined) {
		const last = press.sets.at(-1);

		if (last !== undefined) {
			press.sets.push({
				id: `${press.id}-s4`,
				type: 'normal',
				plannedReps: last.plannedReps,
				weight: last.weight,
				reps: 8,
				rpe: null,
				completed: true
			});
		}
	}

	const curl = nodeFor(workout, 'leg-curl');

	if (curl !== undefined) {
		for (const set of curl.sets) {
			set.plannedReps = 10;
			set.reps = 10;
		}
	}

	workout.entries = workout.entries.filter(
		(entry) => !entry.exercises.some((node) => node.exerciseId === 'standing-calf-raise')
	);

	workout.entries.push({
		id: `${workout.id}-e-extra`,
		exercises: [
			{
				id: `${workout.id}-x-extra`,
				exerciseId: 'cable-crunch',
				sets: Array.from({ length: 3 }, (_, index) => ({
					id: `${workout.id}-x-extra-s${index + 1}`,
					type: 'normal' as const,
					plannedReps: null,
					weight: 25,
					reps: 15 - index,
					rpe: null,
					completed: true
				}))
			}
		]
	});
}

export type SeedBodyweight = { entry: BodyweightEntry; loggedAt: number };

const WEIGH_HOUR = 7;
const WEIGH_MINUTE = 40;

const WEIGH_DAYS = 60;

const END_KG = 80.2;

const SLOPE_PER_DAY = 0.04;

const WOBBLE = [0.3, -0.2, 0.1, 0.4, -0.3, 0, 0.2, -0.4, 0.1, -0.1, 0.3, -0.2, 0, 0.2];

function bodyweightLog(now: number): SeedBodyweight[] {
	const out: SeedBodyweight[] = [];
	const cursor = new Date(now);

	cursor.setHours(WEIGH_HOUR, WEIGH_MINUTE, 0, 0);
	cursor.setDate(cursor.getDate() - 1);

	for (let back = 0; back < WEIGH_DAYS; back++) {
		const away = back >= 23 && back <= 25;

		if (cursor.getDay() !== 0 && !away) {
			const kg =
				Math.round((END_KG + back * SLOPE_PER_DAY + WOBBLE[back % WOBBLE.length]) * 10) / 10;

			out.push({ entry: { date: localDateOf(cursor), kg }, loggedAt: cursor.getTime() });
		}

		cursor.setDate(cursor.getDate() - 1);
	}

	return out.toReversed();
}

export type SeedTemplate = {
	template: Template;
	deletedAt: number | null;
};

export type SeedContent = {
	/** Oldest first. */
	templates: SeedTemplate[];
	/** Oldest first. */
	workouts: FinishedWorkout[];
	/** Oldest first. */
	bodyweight: SeedBodyweight[];
};

export function seedContent(now: number): SeedContent {
	const days = trainingDays(now, BLOCK + 1);
	const [legacyDay, ...blockDays] = days;

	const workouts: FinishedWorkout[] = [];
	const finish = (plan: Plan, workout: Workout): FinishedWorkout =>
		Object.assign(workout, { finishedAt: workout.startedAt + DURATIONS[plan.id] * MINUTE });

	workouts.push(finish(UPPER, workoutOf(UPPER, 'seed-workout-00', legacyDay, 0)));

	for (const [index, startedAt] of blockDays.entries()) {
		const plan = ROTATION[index % ROTATION.length];
		const id = `seed-workout-${String(index + 1).padStart(2, '0')}`;
		const cycle = Math.floor(index / ROTATION.length);

		workouts.push(finish(plan, workoutOf(plan, id, startedAt, cycle)));
	}

	const pushes = workouts.filter((workout) => workout.templateId === PUSH.id);
	const legs = workouts.filter((workout) => workout.templateId === LEGS.id);

	// Second to last, so a later Push session sits between the PR and today.
	const prSession = pushes.at(-2);

	if (prSession !== undefined) {
		plantPr(prSession);
	}

	const skipped = pushes.at(3);

	if (skipped !== undefined) {
		plantSkippedSet(skipped);
	}

	const drifted = legs.at(-1);

	if (drifted !== undefined) {
		plantDrift(drifted);
	}

	const planned = blockDays[0] - DAY;

	const armsWritten = days.at(-3) ?? planned;

	return {
		templates: [
			{ template: templateOf(UPPER, legacyDay - DAY), deletedAt: planned },
			{ template: templateOf(PUSH, planned), deletedAt: null },
			{ template: templateOf(PULL, planned), deletedAt: null },
			{ template: templateOf(LEGS, planned), deletedAt: null },
			{ template: templateOf(ARMS, armsWritten), deletedAt: null }
		],
		workouts,
		bodyweight: bodyweightLog(now)
	};
}
