import { settleRestSeconds } from './rest.ts';
import {
	addExerciseTo as addToTree,
	exerciseIn,
	supersetWith as supersetWithTree
} from './tree.ts';
import type { ExerciseIds, NewExerciseIds } from './tree.ts';
import type { Workout, WorkoutEntry, WorkoutExercise } from './workout.ts';

export {
	joinEntry,
	moveEntry,
	moveExercise,
	removeExercise,
	removeSet,
	splitEntry
} from './tree.ts';
export type { ExerciseIds, NewExerciseIds } from './tree.ts';

export type TemplateSet = {
	id: string;
	plannedReps: number | null;
};

export type TemplateExercise = {
	id: string;
	exerciseId: string;
	sets: TemplateSet[];
	/**
	 * What this plan rests after this exercise, in the same three states the
	 * exercise's own preference has: absent means "whatever the exercise and the
	 * default say", a number means "this instead", and `null` means *never rest
	 * on this here* — the circuit written as a plan rather than as a change of
	 * mind about the movement.
	 *
	 * Optional because every template written before this existed reads as the
	 * absent state, which is what those plans meant.
	 */
	restSeconds?: number | null;
};

export type TemplateEntry = {
	id: string;
	exercises: TemplateExercise[];
};

/**
 * The fifteen glyphs a template can wear, keyed by what the movement is rather
 * than by what the icon draws.
 *
 * Keyed that way because the key is what persists: `legs` survives someone
 * deciding the shoe should be a different shoe, where `sneakerMove` would pin
 * the record to a drawing. The mapping from key to component lives in
 * `$lib/templates/marks`, on the UI side of the framework line this module
 * keeps.
 */
export const MARK_ICONS = [
	'push',
	'pull',
	'legs',
	'core',
	'grip',
	'barbell',
	'machine',
	'run',
	'bike',
	'heavy',
	'power',
	'burn',
	'cardio',
	'steps',
	'star'
] as const;

export type MarkIcon = (typeof MARK_ICONS)[number];

/** Six hues, none of them the accent. The reasoning is in `app.css`. */
export const MARK_COLOURS = ['amber', 'teal', 'blue', 'violet', 'fuchsia', 'slate'] as const;

export type MarkColour = (typeof MARK_COLOURS)[number];

/**
 * Glyph and hue, picked together and stored together.
 *
 * One object rather than two fields, because they are chosen in one surface
 * and because "no mark yet" is then a single absent value rather than two
 * half-states the list would have to decide between.
 */
export type TemplateMark = {
	icon: MarkIcon;
	colour: MarkColour;
};

export type Template = {
	id: string;
	name: string;
	createdAt: number;
	entries: TemplateEntry[];
	/**
	 * Absent until picked, and absent is a rendering: an unmarked template sits
	 * flush where a marked one is indented by its tile.
	 */
	mark?: TemplateMark | null;
	/**
	 * Where the template sits in the list, absent until it has been dragged.
	 *
	 * Absent rather than backfilled, so the field means "someone placed this"
	 * and nothing else. `templateRank` below is what reconciles the two states
	 * onto one number line; nothing else may compare `order` directly.
	 */
	order?: number;
	/**
	 * When the template was put away, or absent/null while it is in use.
	 *
	 * Not a tombstone. `deletedAt` still means gone and still resurrects
	 * nothing; this one keeps the record whole and readable — History's
	 * drift-vs-template line looks a plan up by id long after anyone stopped
	 * training it, and archiving must not be the thing that empties that page.
	 */
	archivedAt?: number | null;
};

/**
 * The one number the list sorts on, whether or not the template was ever
 * dragged.
 *
 * `createdAt` stands in for an absent `order`, which is what makes this a
 * migration nobody has to run: every existing template already has a creation
 * stamp, those stamps are already the order the list was in, and the two live
 * on one scale from the first render. A dragged template gets an `order` that
 * lands between its new neighbours' ranks; an untouched one keeps answering
 * with its birthday forever.
 */
export function templateRank(template: Template): number {
	return template.order ?? template.createdAt;
}

export function byRank(a: Template, b: Template): number {
	return templateRank(a) - templateRank(b);
}

export function isArchived(template: Template): boolean {
	return template.archivedAt !== undefined && template.archivedAt !== null;
}

/**
 * The gap a template is placed at when it lands on an end of the list.
 *
 * Ranks start life as epoch milliseconds, so the scale is ~1.7e12 and any
 * constant is small beside it. A thousand rather than one because a rank has
 * to survive being halved repeatedly — see `reorder` — and starting an end
 * placement one millisecond off its neighbour spends that headroom on the
 * first drag.
 */
const RANK_GAP = 1000;

/**
 * Place `id` at `index` in `order`, and answer with the rank that puts it
 * there — or null if the drag was a no-op.
 *
 * The midpoint of its new neighbours, so a drag writes exactly one record.
 * Renumbering the list from zero would be simpler to read and would push every
 * template on every drop; with each template its own synced record, that turns
 * one gesture into N dirty rows and N conflicts to lose. The neighbours are
 * read from the list *without* the dragged template in it, which is what makes
 * the index the drop reports mean the same thing whether the card travelled up
 * or down.
 *
 * Halving a gap forever is the known cost, and it is not one in practice: the
 * ranks are milliseconds apart at rest, and a double survives ~50 halvings of
 * even a single-millisecond gap. Nothing here renumbers to recover, because
 * the renumber is the write storm this exists to avoid.
 */
export function reorder(templates: Template[], id: string, index: number): number | null {
	const ordered = templates.toSorted(byRank);
	const from = ordered.findIndex((template) => template.id === id);

	if (from === -1 || index < 0 || index >= ordered.length || index === from) {
		return null;
	}

	const rest = ordered.filter((template) => template.id !== id);
	const before = rest[index - 1];
	const after = rest[index];

	if (before === undefined) {
		return templateRank(after) - RANK_GAP;
	}

	if (after === undefined) {
		return templateRank(before) + RANK_GAP;
	}

	return (templateRank(before) + templateRank(after)) / 2;
}

/**
 * A mark this build can draw, or none.
 *
 * Sync is the reason this exists. A record can arrive from a device running a
 * build whose set is bigger than this one's, and an unknown key would reach
 * the component map as an undefined lookup and render nothing inside a tile
 * that still took up space. Falling back to unmarked is the honest read: this
 * build genuinely does not know what that glyph is.
 *
 * It is deliberately not a write path — the payload keeps whatever it arrived
 * with, so the device that understands the key still draws it, and an upgrade
 * here restores the mark rather than finding it erased.
 */
export function drawableMark(template: Template): TemplateMark | null {
	const mark = template.mark;

	if (mark === undefined || mark === null) {
		return null;
	}

	const icons: readonly string[] = MARK_ICONS;
	const colours: readonly string[] = MARK_COLOURS;

	return icons.includes(mark.icon) && colours.includes(mark.colour) ? mark : null;
}

/**
 * What "New template" opens on: nothing named, nothing planned.
 *
 * The id and the timestamp are the caller's — this module has no clock and no
 * randomness, the same reason `freshWorkout` is handed its `startedAt` — and
 * the id doubles as the route the editor lives at, so it has to exist before
 * the template does.
 */
export function blankTemplate(id: string, createdAt: number): Template {
	return { id, name: '', createdAt, entries: [] };
}

export function isBlank(template: Template): boolean {
	return template.name.trim() === '' && template.entries.length === 0;
}

export const PLANNED_SET_COUNT = 3;

export const PLANNED_REPS = 8;

const blankExercise =
	(catalogId: string) =>
	(ids: ExerciseIds): TemplateExercise => ({
		id: ids.exercise,
		exerciseId: catalogId,
		sets: ids.sets.map((id) => ({ id, plannedReps: null }))
	});

export function addExercise(
	template: Template,
	exerciseId: string,
	ids: NewExerciseIds
): TemplateEntry | null {
	if (ids.sets.length === 0) {
		return null;
	}

	const entry: TemplateEntry = { id: ids.entry, exercises: [blankExercise(exerciseId)(ids)] };

	template.entries.push(entry);

	return entry;
}

export function addExerciseTo(
	template: Template,
	entryId: string,
	catalogId: string,
	ids: ExerciseIds
): TemplateExercise | null {
	return addToTree(template, entryId, ids, blankExercise(catalogId));
}

export function supersetWith(
	template: Template,
	entryId: string,
	catalogId: string,
	ids: ExerciseIds
): boolean {
	return supersetWithTree(template, entryId, catalogId, ids, blankExercise(catalogId));
}

export function replaceExercise(
	template: Template,
	exerciseId: string,
	catalogId: string
): boolean {
	const exercise = exerciseIn(template, exerciseId);

	if (exercise === null || exercise.exerciseId === catalogId) {
		return false;
	}

	exercise.exerciseId = catalogId;

	return true;
}

export function addSet(template: Template, exerciseId: string, id: string): TemplateSet | null {
	const exercise = exerciseIn(template, exerciseId);

	if (exercise === null) {
		return null;
	}

	const last = exercise.sets.at(-1);
	const set: TemplateSet = { id, plannedReps: last === undefined ? null : last.plannedReps };

	exercise.sets.push(set);

	return set;
}

export function setPlannedReps(template: Template, setId: string, reps: number | null): boolean {
	if (reps !== null && reps < 1) {
		return false;
	}

	for (const entry of template.entries) {
		for (const exercise of entry.exercises) {
			for (const set of exercise.sets) {
				if (set.id === setId) {
					set.plannedReps = reps;

					return true;
				}
			}
		}
	}

	return false;
}

export function setExerciseReps(
	template: Template,
	exerciseId: string,
	reps: number | null
): boolean {
	if (reps !== null && reps < 1) {
		return false;
	}

	const exercise = exerciseIn(template, exerciseId);

	if (exercise === null) {
		return false;
	}

	for (const set of exercise.sets) {
		set.plannedReps = reps;
	}

	return true;
}

/**
 * The plan's own rest for one exercise, in all three states.
 *
 * `undefined` is a value here and not a missing argument: it is how a card says
 * *inherit again*, and it deletes the key rather than writing an undefined one
 * — `restSecondsOf` reads an absence, and a key that is present and undefined
 * is a distinction no payload should have to carry.
 */
export function setExerciseRest(
	template: Template,
	exerciseId: string,
	seconds: number | null | undefined
): boolean {
	const exercise = exerciseIn(template, exerciseId);

	if (exercise === null) {
		return false;
	}

	if (seconds === undefined) {
		delete exercise.restSeconds;
	} else {
		exercise.restSeconds = seconds === null ? null : settleRestSeconds(seconds);
	}

	return true;
}

export function startFrom(template: Template, startedAt: number, mint: () => string): Workout {
	const entries: WorkoutEntry[] = template.entries.map((entry) => ({
		id: mint(),
		exercises: entry.exercises.map((exercise) => {
			const copy: WorkoutExercise = {
				id: mint(),
				exerciseId: exercise.exerciseId,
				sets: exercise.sets.map((set) => ({
					id: mint(),
					type: 'normal' as const,
					plannedReps: set.plannedReps,
					rpe: null,
					weight: null,
					reps: null,
					completed: false
				}))
			};

			// Copied, not looked up later: the session has to survive this template
			// being edited or deleted from under it, and a workout repeated out of
			// History has no template to ask at all. Set only when the plan has an
			// opinion, so an inherited rest stays an absence rather than becoming a
			// key holding undefined.
			if (exercise.restSeconds !== undefined) {
				copy.restSeconds = exercise.restSeconds;
			}

			return copy;
		})
	}));

	return { id: mint(), templateId: template.id, startedAt, entries };
}
