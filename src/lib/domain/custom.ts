import type { Equipment, Exercise, Grip, GripAxis, LoadMode, MuscleTargets } from './exercise.ts';
import { EQUIPMENT, LOAD_MODES, MUSCLES } from './exercise.ts';
import { normalize } from './search.ts';

// Preference records rather than a kind of their own: a server that predates customs 400s a
// whole push holding an unknown kind, and syncs a preference it has never heard of unchanged.
export const CUSTOM_EXERCISE_PREFIX = 'exercise:';

export const CUSTOM_GRIP_PREFIX = 'grip:';

// A catalog slug is lowercase words joined by hyphens, so an underscore can never be one.
const CUSTOM_MARK = 'custom_';

// Stamped onto sets once an axis exists, so it must never be a value a catalog axis could add.
export const CUSTOM_DEFAULT_GRIP = 'custom_standard';

export type CustomExercisePreference = {
	name: string;
	equipment: Equipment;
	loadMode: LoadMode;
	muscles: MuscleTargets;
	variantOf: string | null;
	archivedAt: number | null;
};

export type CustomGripPreference = { exerciseId: string; label: string; createdAt: number };

/** What the lifter states about a custom exercise; the rest is bookkeeping. */
export type CustomDraft = Omit<CustomExercisePreference, 'archivedAt'>;

/** Every exercise there is to this lifter: the catalog, their customs and their grips. */
export type Catalog = {
	/** What lists and pickers offer: archived customs left out. */
	exercises: Exercise[];
	/** Everything a stored id can name, archived customs included. */
	byId: Record<string, Exercise>;
};

export type PreferenceRow = { id: string; payload: unknown };

export function newCustomId(): string {
	return `${CUSTOM_MARK}${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

export function isCustomId(id: string): boolean {
	return id.startsWith(CUSTOM_MARK);
}

export function customExerciseId(exerciseId: string): string {
	return `${CUSTOM_EXERCISE_PREFIX}${exerciseId}`;
}

export function customGripId(gripId: string): string {
	return `${CUSTOM_GRIP_PREFIX}${gripId}`;
}

export function isCustomRecord(id: string): boolean {
	return id.startsWith(CUSTOM_EXERCISE_PREFIX) || id.startsWith(CUSTOM_GRIP_PREFIX);
}

function isPayload(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(options: readonly T[], value: unknown): value is T {
	const known: readonly string[] = options;

	return typeof value === 'string' && known.includes(value);
}

function isMuscles(value: unknown): value is MuscleTargets {
	return (
		isPayload(value) &&
		isOneOf(MUSCLES, value.primary) &&
		Array.isArray(value.secondary) &&
		value.secondary.every((muscle) => isOneOf(MUSCLES, muscle))
	);
}

const isLabel = (value: unknown): value is string =>
	typeof value === 'string' && value.trim() !== '';

export function isCustomExercisePreference(value: unknown): value is CustomExercisePreference {
	return (
		isPayload(value) &&
		isLabel(value.name) &&
		isOneOf(EQUIPMENT, value.equipment) &&
		isOneOf(LOAD_MODES, value.loadMode) &&
		isMuscles(value.muscles) &&
		(value.variantOf === undefined ||
			value.variantOf === null ||
			typeof value.variantOf === 'string') &&
		(value.archivedAt === undefined ||
			value.archivedAt === null ||
			(typeof value.archivedAt === 'number' && Number.isFinite(value.archivedAt)))
	);
}

export function isCustomGripPreference(value: unknown): value is CustomGripPreference {
	return (
		isPayload(value) &&
		typeof value.exerciseId === 'string' &&
		isLabel(value.label) &&
		(value.createdAt === undefined ||
			(typeof value.createdAt === 'number' && Number.isFinite(value.createdAt)))
	);
}

/** A draft as it is stored: trimmed, the primary never repeated among the secondaries. */
export function settleDraft(draft: CustomDraft): CustomDraft {
	const { primary } = draft.muscles;

	return {
		name: draft.name.trim().replaceAll(/\s+/gu, ' '),
		equipment: draft.equipment,
		loadMode: draft.loadMode,
		muscles: {
			primary,
			secondary: MUSCLES.filter(
				(muscle) => muscle !== primary && draft.muscles.secondary.includes(muscle)
			)
		},
		variantOf: draft.variantOf
	};
}

/** The exercise a new name would duplicate — by its name or by a spelling it answers to. */
export function sameName(
	pool: Exercise[],
	name: string,
	self: string | null
): Exercise | undefined {
	const wanted = normalize(name);

	if (wanted === '') {
		return undefined;
	}

	return pool.find(
		(exercise) =>
			exercise.id !== self &&
			(normalize(exercise.name) === wanted || exercise.aliases.includes(wanted))
	);
}

// Families are one level deep: naming a variant hangs the custom beside it, under its root.
function rootOf(base: Record<string, Exercise>, variantOf: string | null): Exercise | undefined {
	const named = variantOf === null ? undefined : base[variantOf];

	if (named === undefined) {
		return undefined;
	}

	return named.variantOf === undefined ? named : (base[named.variantOf] ?? named);
}

function customExerciseOf(
	id: string,
	stored: CustomExercisePreference,
	base: Record<string, Exercise>
): Exercise {
	const parent = rootOf(base, stored.variantOf ?? null);

	const exercise: Exercise = {
		id,
		name: stored.name,
		aliases: [],
		equipment: stored.equipment,
		loadMode: stored.loadMode,
		muscles: { primary: stored.muscles.primary, secondary: [...stored.muscles.secondary] },
		custom: true
	};

	if (parent !== undefined) {
		exercise.variantOf = parent.id;

		if (parent.pattern !== undefined) {
			exercise.pattern = parent.pattern;
		}

		// A custom has no way to state a share, so a body-weight one borrows its family's.
		if (stored.equipment === 'Bodyweight' && parent.equipment === 'Bodyweight') {
			exercise.bodyweightShare = parent.bodyweightShare;
		}
	}

	if (typeof stored.archivedAt === 'number') {
		exercise.archived = true;
	}

	return exercise;
}

function withGrips(exercise: Exercise, added: Grip[]): Exercise {
	const axis: GripAxis = exercise.grips ?? {
		label: 'Grip',
		default: CUSTOM_DEFAULT_GRIP,
		values: [{ id: CUSTOM_DEFAULT_GRIP, label: 'Standard' }]
	};

	const taken = new Set(axis.values.map((value) => value.id));

	const values = [...axis.values, ...added.filter((grip) => !taken.has(grip.id))];

	const grips: GripAxis = Object.assign(structuredClone(axis), { values });

	return Object.assign(structuredClone(exercise), { grips });
}

// A grip naming an exercise nobody has is dropped, so a deleted custom takes its grips with it.
export function withCustoms(base: Exercise[], preferences: PreferenceRow[]): Catalog {
	const baseById: Record<string, Exercise> = Object.fromEntries(
		base.map((exercise) => [exercise.id, exercise])
	);

	const customs: Exercise[] = [];
	const grips = new Map<string, (Grip & { createdAt: number })[]>();

	for (const { id, payload } of preferences) {
		if (id.startsWith(CUSTOM_EXERCISE_PREFIX)) {
			const exerciseId = id.slice(CUSTOM_EXERCISE_PREFIX.length);

			if (isCustomId(exerciseId) && isCustomExercisePreference(payload)) {
				customs.push(customExerciseOf(exerciseId, payload, baseById));
			}
		} else if (id.startsWith(CUSTOM_GRIP_PREFIX)) {
			const gripId = id.slice(CUSTOM_GRIP_PREFIX.length);

			if (isCustomId(gripId) && isCustomGripPreference(payload)) {
				const list = grips.get(payload.exerciseId) ?? [];

				list.push({
					id: gripId,
					label: payload.label.trim(),
					custom: true,
					createdAt: payload.createdAt ?? 0
				});
				grips.set(payload.exerciseId, list);
			}
		}
	}

	const gripped = (exercise: Exercise): Exercise => {
		const added = grips.get(exercise.id);

		if (added === undefined) {
			return exercise;
		}

		const ordered = added
			.toSorted((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
			.map(({ id, label, custom }): Grip => ({ id, label, custom }));

		return withGrips(exercise, ordered);
	};

	const all = [...base, ...customs.toSorted((a, b) => a.name.localeCompare(b.name))].map(
		(exercise) => gripped(exercise)
	);

	return {
		exercises: all.filter((exercise) => exercise.archived !== true),
		byId: Object.fromEntries(all.map((exercise) => [exercise.id, exercise]))
	};
}
