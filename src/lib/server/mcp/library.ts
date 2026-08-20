import { and, eq, isNull } from 'drizzle-orm';

import { catalogById } from '$lib/catalog';
import type { BodyweightEntry } from '$lib/domain/bodyweight';
import type { Exercise } from '$lib/domain/exercise';
import { loadFactor } from '$lib/domain/exercise';
import type { Carried } from '$lib/domain/load';
import { carriedFrom } from '$lib/domain/load';
import {
	NOTE_PREFIX,
	REST_DEFAULT_ID,
	isNotePreference,
	isRestDefaultPreference,
	isRestOverridePreference,
	restOverrideExercise
} from '$lib/domain/preference';
import { defaultRestSettings } from '$lib/domain/rest';
import type { RestSettings } from '$lib/domain/rest';
import { lastDoneByTemplate } from '$lib/domain/rotation';
import type { PastSession } from '$lib/domain/stats';
import type { Template } from '$lib/domain/template';
import { byRank } from '$lib/domain/template';
import type { FinishedWorkout, LastPerformed } from '$lib/store/derive';
import { lastPerformedFrom, sessionsByExercise } from '$lib/store/derive';
import type { RecordKind } from '$lib/sync/protocol';

import type { Database } from '../db/client.ts';
import { records } from '../db/schema.ts';

type Preference = { id: string; payload: unknown };

/**
 * One user's records, read as the domain rather than as rows.
 *
 * The sync store is deliberately incurious — it holds opaque payloads under four kinds and
 * has never needed to know what any of them mean. This is where the server learns, and it
 * learns by importing the same modules the phone computes with, so a number quoted over MCP
 * is the number on the phone rather than a second implementation that agrees for now.
 *
 * Every read is memoised for the life of the instance, which is one request: the derived
 * views each walk the whole history, and a tool that asks for three of them should pay for
 * the walk once.
 */
export class Library {
	private readonly db: Database;

	private readonly userId: string;

	private readonly memo = new Map<string, unknown>();

	public constructor(db: Database, userId: string) {
		this.db = db;
		this.userId = userId;
	}

	/**
	 * Forget everything read so far, because a write has just made it untrue.
	 *
	 * One POST can carry several calls — the transport parses a JSON-RPC array — so a read
	 * that follows a write on this instance would otherwise answer from before it, and
	 * contradict the write it was told succeeded.
	 */
	public invalidate(): void {
		this.memo.clear();
	}

	private once<T>(key: string, compute: () => T): T {
		if (!this.memo.has(key)) {
			this.memo.set(key, compute());
		}

		// oxlint-disable-next-line typescript/no-unsafe-type-assertion
		return this.memo.get(key) as T;
	}

	private live(kind: RecordKind): { id: string; payload: unknown }[] {
		return this.db
			.select({ id: records.id, payload: records.payload })
			.from(records)
			.where(
				and(eq(records.userId, this.userId), eq(records.kind, kind), isNull(records.deletedAt))
			)
			.all();
	}

	/**
	 * The version stamp a caller must quote back to edit a record.
	 *
	 * Kept apart from the payload reads rather than threaded through them: the stamp is
	 * bookkeeping the domain has no use for, and only the two or three tools that hand out
	 * something editable should pay for the extra column.
	 */
	private stamps(): Record<string, number> {
		return this.once('stamps', () => {
			const out: Record<string, number> = {};

			const rows = this.db
				.select({ id: records.id, updatedAt: records.updatedAt })
				.from(records)
				.where(and(eq(records.userId, this.userId), isNull(records.deletedAt)))
				.all();

			for (const row of rows) {
				out[row.id] = row.updatedAt;
			}

			return out;
		});
	}

	public version(id: string): number | null {
		return this.stamps()[id] ?? null;
	}

	/** Finished workouts, oldest first — the order every derived view expects. */
	public workouts(): FinishedWorkout[] {
		return this.once('workouts', () =>
			this.live('workout')
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion
				.map((row) => row.payload as FinishedWorkout)
				.toSorted((a, b) => a.startedAt - b.startedAt)
		);
	}

	public workout(id: string): FinishedWorkout | null {
		return this.workouts().find((workout) => workout.id === id) ?? null;
	}

	/** Every plan, archived included, in the order the lifter dragged them into. */
	public templates(): Template[] {
		return this.once('templates', () =>
			this.live('template')
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion
				.map((row) => row.payload as Template)
				.toSorted(byRank)
		);
	}

	public template(id: string): Template | null {
		return this.templates().find((template) => template.id === id) ?? null;
	}

	public bodyweight(): BodyweightEntry[] {
		return this.once('bodyweight', () =>
			this.live('bodyweight')
				// oxlint-disable-next-line typescript/no-unsafe-type-assertion
				.map((row) => row.payload as BodyweightEntry)
				.toSorted((a, b) => a.date.localeCompare(b.date))
		);
	}

	/**
	 * Memoised with everything else: the resolver caches its own lookups, so handing out a
	 * fresh one per tool would throw that cache away between two numbers of the same answer.
	 */
	public carried(): Carried {
		return this.once('carried', () => carriedFrom(this.bodyweight(), (id) => catalogById[id]));
	}

	private preferences(): Preference[] {
		return this.once('preferences', () => this.live('preference'));
	}

	public sessions(): Record<string, PastSession[]> {
		return this.once('sessions', () => sessionsByExercise(this.workouts()));
	}

	public pastSessions(exerciseId: string): PastSession[] {
		return this.sessions()[exerciseId] ?? [];
	}

	/** When each plan was last trained — the arithmetic the rotation reads. */
	public lastDone(): Record<string, number> {
		return this.once('lastDone', () => lastDoneByTemplate(this.workouts()));
	}

	public lastPerformed(): LastPerformed {
		return this.once('lastPerformed', () => lastPerformedFrom(this.workouts()));
	}

	public restSettings(): RestSettings {
		return this.once('rest', () => {
			const settings = defaultRestSettings();

			for (const { id, payload } of this.preferences()) {
				if (id === REST_DEFAULT_ID && isRestDefaultPreference(payload)) {
					settings.enabled = payload.enabled;
					settings.seconds = payload.seconds;

					continue;
				}

				const exerciseId = restOverrideExercise(id);

				if (exerciseId !== null && isRestOverridePreference(payload)) {
					settings.overrides[exerciseId] = payload.seconds;
				}
			}

			return settings;
		});
	}

	/** Standing notes by exercise — the seat number and the grip, never in the logging loop. */
	public notes(): Record<string, string> {
		return this.once('notes', () => {
			const out: Record<string, string> = {};

			for (const { id, payload } of this.preferences()) {
				if (id.startsWith(NOTE_PREFIX) && isNotePreference(payload)) {
					out[id.slice(NOTE_PREFIX.length)] = payload.text;
				}
			}

			return out;
		});
	}

	public noteOf(exerciseId: string): string | null {
		return this.notes()[exerciseId] ?? null;
	}
}

export function exerciseOf(exerciseId: string): Exercise | undefined {
	return catalogById[exerciseId];
}

/** An exercise's name, falling back to the id itself for a slug the catalogue has folded away. */
export function nameOf(exerciseId: string): string {
	const known = catalogById[exerciseId];

	return known === undefined ? exerciseId : known.name;
}

/** The ids in a written tree the catalogue has never heard of — the one gate every write shares. */
export function unknownIds(exercises: { exerciseId: string }[]): string[] {
	return exercises
		.map((exercise) => exercise.exerciseId)
		.filter((id) => catalogById[id] === undefined);
}

/**
 * Volume's multiplier for an exercise, defaulting to 1 for an id the catalog has never
 * heard of — a folded-away slug or a build older than the entry, neither worth a throw.
 */
export function loadFactorOf(exerciseId: string): number {
	const known = catalogById[exerciseId];

	return loadFactor(known === undefined ? 'total' : known.loadMode);
}
