import { catalogById } from '$lib/catalog';
import type { BodyweightEntry } from '$lib/domain/bodyweight';
import { localDateOf } from '$lib/domain/bodyweight';
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
	'load_kg'
] as const;

export const BODYWEIGHT_COLUMNS = ['date', 'kg'] as const;

export function csvField(value: Cell): string {
	const text = value === null ? '' : String(value);

	return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function csvOf(header: readonly string[], rows: Cell[][]): string {
	return [header, ...rows]
		.map((row) => `${row.map((cell) => csvField(cell)).join(',')}\r\n`)
		.join('');
}

function loadOf(
	exerciseId: string,
	weight: number | null,
	date: string,
	bodyweight: BodyweightEntry[]
): number | null {
	const share = bodyweightShareOf(catalogById[exerciseId]);
	const carried = share === 0 ? null : bodyweightOn(bodyweight, date);

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

		for (const { set, exercise, workingIndex } of cursors(workout)) {
			const meta = catalogById[exercise.exerciseId];

			rows.push([
				date,
				title,
				meta === undefined ? exercise.exerciseId : meta.name,
				workingIndex < 0 ? null : workingIndex + 1,
				set.type,
				set.weight,
				meta === undefined ? null : meta.loadMode,
				set.reps,
				set.rpe,
				gripLabel(meta, set.grip) ?? null,
				set.arms ?? 'both',
				set.completed ? 'true' : 'false',
				loadOf(exercise.exerciseId, set.weight, date, bodyweight)
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
