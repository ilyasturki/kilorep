/**
 * Eight weeks of training for the dev account — what `bun run db:seed` plants
 * so a fresh worktree opens on an app that has been used, rather than on four
 * empty screens and a hint system with nothing to recall.
 *
 * Deterministic and clock-free in the same sense the domain layer is: nothing
 * below is random, every load is derived from the table that also builds the
 * template, and the one thing that moves between runs is the anchor the caller
 * hands in. The block always ends *yesterday*, so a database seeded in March
 * and a database seeded today both open on an app that was last used
 * yesterday.
 *
 * Shaped on a real log rather than invented. The split, the exercise mix, the
 * starting loads and the rep ranges are six months of the author's own
 * training compressed into eight weeks, which is why so few numbers are round:
 * a seed where every lift is a multiple of ten reads as test data on sight, and
 * the screens that render it were designed against weights like 77.5.
 *
 * Data only — no framework, no catalog import. Exercise ids are catalog slugs
 * as bare strings and `tests/seed-content.test.ts` is what proves they still
 * resolve; importing `$lib/catalog` here would drag an alias into a file Node
 * runs directly.
 */

import type { Template, TemplateEntry } from '../../src/lib/domain/template.ts';
import type { Workout, WorkoutEntry, WorkoutSet } from '../../src/lib/domain/workout.ts';
import type { FinishedWorkout } from '../../src/lib/store/derive.ts';

/**
 * One exercise, planned and performed from a single row.
 *
 * The template and the twenty-four sessions that perform it are two
 * projections of this table rather than two authored lists — a plan and a log
 * that disagree about which exercises a day holds is exactly the bug the drift
 * screen exists to show, and it must be planted deliberately (see
 * `plantDrift`) rather than arrived at by a typo.
 */
type PlannedExercise = {
	/** A catalog slug. Checked by the test, not by this module. */
	exerciseId: string;
	sets: number;
	/** The plan's rep target, and null is PRODUCT.md's open target. */
	plannedReps: number | null;
	/** What the opening sets of a session actually hit. */
	performedReps: number;
	/** Kilograms in the first session of the block. */
	start: number;
	/** What it climbs by, one step every second session — see `loadFor`. */
	step: number;
	/** A warmup at this load precedes the working sets. Heavy barbell lifts only. */
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
		// The open target: the plan prescribes nothing and the rep field falls
		// through to the hint, which is a path with no other coverage in a seeded
		// database.
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
		// Added weight, which is what a loaded bodyweight lift means everywhere
		// else too; the first session's back-off would go to zero and is
		// suppressed by `weightFor`.
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

/**
 * Planned and never started. The loads are unused — nothing performs this — and
 * present only because the row shape is one table; what the template is here
 * for is the state where a plan exists, four exercises hang off it, and every
 * one of them reads "never performed" on the catalog row and the detail screen.
 */
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

/**
 * The split that came before, deleted the day the three-day rotation started
 * and performed exactly once — the oldest session in the log.
 *
 * A workout whose template is a tombstone is ordinary rather than an edge case
 * (templates are working documents and workouts outlive them), and it is the
 * only way to see `workoutTitle` fall back to naming the session's contents.
 * It also leaves three exercises with a single session, weeks back, which is
 * what the catalog's "am I neglecting this" column was built to show.
 */
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
		// Not `barbell-curl`: the Arms plan is the never-performed state, and that
		// only holds while nothing in the log has ever trained one of its lifts.
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

/** Push, pull, legs, repeating — eight sessions of each across the block. */
const ROTATION = [PUSH, PULL, LEGS];

/** Twenty-four sessions: eight weeks at three a week, and a whole number of rotations. */
const BLOCK = 24;

/** Monday, Wednesday, Friday. */
const TRAINING_WEEKDAYS = [1, 3, 5];

/** Sessions start in the evening; only the hour is arbitrary. */
const START_HOUR = 18;
const START_MINUTE = 30;

const MINUTE = 60_000;
const DAY = 86_400_000;

/**
 * How long each day takes, in minutes. Different per plan so History renders
 * more than one duration — a column where every row says "62 min" tests
 * nothing.
 */
const DURATIONS: Record<string, number> = {
	[PUSH.id]: 62,
	[PULL.id]: 68,
	[LEGS.id]: 71,
	[UPPER.id]: 74
};

/**
 * Session starts, oldest first, ending yesterday.
 *
 * Walked backwards a day at a time rather than computed from a stride: the
 * Mon/Wed/Fri grid has an uneven gap in it (Friday to Monday is three days),
 * and the loop is the shape that cannot get that wrong.
 */
function trainingDays(now: number, count: number): number[] {
	const days: number[] = [];
	const cursor = new Date(now);

	cursor.setHours(START_HOUR, START_MINUTE, 0, 0);
	cursor.setDate(cursor.getDate() - 1);

	while (days.length < count) {
		if (TRAINING_WEEKDAYS.includes(cursor.getDay())) {
			days.push(cursor.getTime());
		}

		cursor.setDate(cursor.getDate() - 1);
	}

	return days.toReversed();
}

/**
 * The load for a session: one step every second session, so eight sessions is
 * four increases. That is what eight weeks of honest linear progression looks
 * like on a barbell, and it is deliberately not every session — a log that
 * goes up every time is a log nobody has ever kept.
 */
function loadFor(exercise: PlannedExercise, sessionIndex: number): number {
	return exercise.start + exercise.step * Math.floor(sessionIndex / 2);
}

/**
 * The last set comes down one increment — the back-off every real fourth set
 * is. Suppressed when it would reach zero or below, which only the first
 * sessions of the weighted pull-up can do.
 */
function weightFor(exercise: PlannedExercise, sessionIndex: number, setIndex: number): number {
	const load = loadFor(exercise, sessionIndex);
	const isLast = setIndex === exercise.sets - 1;

	return isLast && load - exercise.step > 0 ? load - exercise.step : load;
}

/**
 * Reps hit on one set. Two at target, then a rep short — the decay that makes
 * consecutive sets tell each other apart, so an off-by-one in the hint index
 * cannot hide behind interchangeable numbers.
 *
 * Every third session opens with a rep more. It is the difference between a
 * log and a spreadsheet, and it means "last time" and "best" are not the same
 * question for most exercises.
 */
function repsFor(exercise: PlannedExercise, sessionIndex: number, setIndex: number): number {
	const base = setIndex < 2 ? exercise.performedReps : exercise.performedReps - 1;
	const goodDay = sessionIndex % 3 === 2 && setIndex === 0;

	return goodDay ? base + 1 : base;
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
		completed: true
	};
}

/** The template as the editor would have saved it: the plan, minus every load. */
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

/**
 * One performed session: the plan's tree with every set logged and checked.
 *
 * `sessionIndex` counts this plan's own sessions, not the block's — progression
 * is per lift, and Push day eight is bench session eight whatever fell between.
 */
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

/** Every exercise node in a workout, flattened — what the planting below edits. */
function exerciseNodes(workout: Workout) {
	return workout.entries.flatMap((entry) => entry.exercises);
}

function nodeFor(workout: Workout, exerciseId: string) {
	return exerciseNodes(workout).find((node) => node.exerciseId === exerciseId);
}

/**
 * A raw PR that is not the most recent session: a heavy triple two Push days
 * from the end, so the exercise detail's "best" and "last time" render
 * different numbers. `bestSet` keeps the first achievement, and nothing after
 * this session goes near the load.
 */
function plantPr(workout: Workout): void {
	const node = nodeFor(workout, 'bench-press');
	const top = node?.sets.find((set) => set.type === 'normal');

	if (top !== undefined) {
		top.weight = 82.5;
		top.reps = 3;
	}
}

/**
 * A set left unchecked: the lifter ran out of time on the last pushdown.
 *
 * Not decoration. It is the only row in a seeded database that must be counted
 * by nothing — not volume, not the hint, not the set tally — and CLAUDE.md's
 * volume rule is otherwise only asserted against warmups here.
 */
function plantSkippedSet(workout: Workout): void {
	const node = nodeFor(workout, 'triceps-pushdown');
	const last = node?.sets.at(-1);

	if (last !== undefined) {
		last.weight = null;
		last.reps = null;
		last.completed = false;
	}
}

/**
 * A session that did not go to plan, in all four ways `driftFrom` can report:
 * a set added to the leg press, the calf raises skipped entirely, the leg curl
 * run at a different rep target, and an ab exercise nobody planned tacked on
 * the end.
 *
 * One workout carries all four because the drift surface renders them together
 * and a seed that plants them in four different sessions never shows the shape
 * the screen was designed for.
 */
function plantDrift(workout: Workout): void {
	const press = nodeFor(workout, 'leg-press');
	const last = press?.sets.at(-1);

	if (press !== undefined && last !== undefined) {
		press.sets.push({
			id: `${press.id}-s4`,
			type: 'normal',
			plannedReps: last.plannedReps,
			weight: last.weight,
			reps: 8,
			completed: true
		});
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
					completed: true
				}))
			}
		]
	});
}

/** A template as the seed plants it: the payload, plus the tombstone if it has one. */
export type SeedTemplate = {
	template: Template;
	deletedAt: number | null;
};

export type SeedContent = {
	/** Oldest first. */
	templates: SeedTemplate[];
	/** Oldest first. */
	workouts: FinishedWorkout[];
};

/**
 * The whole seed, anchored on `now`: five templates (one of them a tombstone)
 * and twenty-five finished sessions, the last of them yesterday.
 *
 * `now` is a parameter and not a `Date.now()` call for the reason every other
 * module here takes its clock from the edge — the test hands in a fixed
 * instant and gets the same tree every time.
 */
export function seedContent(now: number): SeedContent {
	// One more day than the block: the oldest is the Upper Body session the
	// split replaced.
	const days = trainingDays(now, BLOCK + 1);
	const [legacyDay, ...blockDays] = days;

	const workouts: FinishedWorkout[] = [];
	const finish = (plan: Plan, workout: Workout): FinishedWorkout => ({
		...workout,
		finishedAt: workout.startedAt + DURATIONS[plan.id] * MINUTE
	});

	workouts.push(finish(UPPER, workoutOf(UPPER, 'seed-workout-00', legacyDay, 0)));

	blockDays.forEach((startedAt, index) => {
		const plan = ROTATION[index % ROTATION.length];
		const id = `seed-workout-${String(index + 1).padStart(2, '0')}`;

		workouts.push(
			finish(plan, workoutOf(plan, id, startedAt, Math.floor(index / ROTATION.length)))
		);
	});

	const pushes = workouts.filter((workout) => workout.templateId === PUSH.id);
	const legs = workouts.filter((workout) => workout.templateId === LEGS.id);

	// Second to last, so a Push day sits between the PR and today.
	const prSession = pushes.at(-2);

	if (prSession !== undefined) {
		plantPr(prSession);
	}

	// Mid-block, where an unchecked set is a session that ran long rather than
	// the log trailing off at the end.
	const skipped = pushes.at(3);

	if (skipped !== undefined) {
		plantSkippedSet(skipped);
	}

	const drifted = legs.at(-1);

	if (drifted !== undefined) {
		plantDrift(drifted);
	}

	// Written before the first session that performs them, which is the order a
	// real account grows in: plan, then train.
	const planned = blockDays[0] - DAY;

	return {
		templates: [
			// Deleted the day the rotation started — the split it replaced.
			{ template: templateOf(UPPER, legacyDay - DAY), deletedAt: planned },
			{ template: templateOf(PUSH, planned), deletedAt: null },
			{ template: templateOf(PULL, planned), deletedAt: null },
			{ template: templateOf(LEGS, planned), deletedAt: null },
			// Recent, and never started: a plan made last week and not yet run.
			{ template: templateOf(ARMS, days[days.length - 3]), deletedAt: null }
		],
		workouts
	};
}
