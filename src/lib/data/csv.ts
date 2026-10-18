import { catalogById } from '$lib/catalog';
import type { BodyweightEntry } from '$lib/domain/bodyweight';
import { localDateOf } from '$lib/domain/bodyweight';
import type { Exercise } from '$lib/domain/exercise';
import { gripLabel } from '$lib/domain/grip';
import { bodyweightOn, bodyweightShareOf } from '$lib/domain/load';
import type { Template } from '$lib/domain/template';
import { cursors } from '$lib/domain/workout';
import { workoutTitle } from '$lib/history/label';
import type { FinishedWorkout } from '$lib/store/derive';

type Cell = string | number | null;

export const SET_COLUMNS = [
	'date',
	'workout',
	'exercise',
	'set',
	'type',
	'weight_kg',
	'load_mode',
	'reps',
	'rpe',
	'grip',
	'arms',
	'completed',
	'load_kg',
	'note'
] as const;

export const BODYWEIGHT_COLUMNS = ['date', 'kg'] as const;

export function csvField(value: Cell): string {
	const text = String(value ?? '');

	return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csvOf(header: readonly string[], rows: Cell[][]): string {
	return [header, ...rows]
		.map((row) => `${row.map((cell) => csvField(cell)).join(',')}\r\n`)
		.join('');
}

function loadOf(
	meta: Exercise | undefined,
	weight: number | null,
	weighIn: number | null
): number | null {
	const share = bodyweightShareOf(meta);
	const carried = share === 0 ? null : weighIn;

	if (weight === null || carried === null) {
		return null;
	}

	return Math.round((weight + carried * share) * 10) / 10;
}

// Superset legs interleave round by round, as performed; warmups take no set number.
export function setsCsv(
	workouts: FinishedWorkout[],
	templates: Template[],
	bodyweight: BodyweightEntry[]
): string {
	const rows: Cell[][] = [];

	for (const workout of workouts) {
		const date = localDateOf(new Date(workout.startedAt));
		const title = workoutTitle(workout, templates);
		const weighIn = bodyweightOn(bodyweight, date);

		for (const { set, exercise, workingIndex } of cursors(workout)) {
			const meta = catalogById[exercise.exerciseId];
			// A set from an older build may lack its numbers altogether.
			const weight = set.weight ?? null;

			rows.push([
				date,
				title,
				meta === undefined ? exercise.exerciseId : meta.name,
				workingIndex < 0 ? null : workingIndex + 1,
				set.type,
				weight,
				meta === undefined ? null : meta.loadMode,
				set.reps,
				set.rpe,
				gripLabel(meta, set.grip) ?? null,
				set.arms ?? 'both',
				set.completed ? 'true' : 'false',
				loadOf(meta, weight, weighIn),
				exercise.note ?? null
			]);
		}
	}

	return csvOf(SET_COLUMNS, rows);
}

export function bodyweightCsv(entries: BodyweightEntry[]): string {
	return csvOf(
		BODYWEIGHT_COLUMNS,
		entries.map((entry) => [entry.date, entry.kg])
	);
}

export function csvNames(now: number): { sets: string; bodyweight: string } {
	const day = localDateOf(new Date(now));

	return { sets: `kilorep-sets-${day}.csv`, bodyweight: `kilorep-bodyweight-${day}.csv` };
}
