import 'fake-indexeddb/auto';

import { describe, expect, it } from 'vitest';

import { openDatabase } from '$lib/store/db';
import { Store } from '$lib/store/store';
import type { StoreContents } from '$lib/store/store';
import type { Template } from '$lib/domain/template';
import type { Workout } from '$lib/domain/workout';
import type { FinishedWorkout } from '$lib/store/derive';
import type { WireRecord } from '$lib/sync/protocol';

import { BACKUP_FORMAT, backupName, backupOf, readBackup } from './backup.ts';

let counter = 0;

async function freshStore(): Promise<Store> {
	counter += 1;

	return new Store(await openDatabase(`kilorep-backup-test-${counter}`));
}

const day = (date: string, hour = 9): number =>
	new Date(`${date}T${String(hour).padStart(2, '0')}:00`).getTime();

function session(id: string, startedAt: number): Workout {
	return {
		id,
		templateId: 'push',
		startedAt,
		entries: [
			{
				id: `${id}-e1`,
				exercises: [
					{
						id: `${id}-x1`,
						exerciseId: 'bench-press',
						grip: 'close',
						restSeconds: 150,
						sets: [
							{
								id: `${id}-s1`,
								type: 'warmup',
								plannedReps: null,
								weight: 40,
								reps: 10,
								rpe: null,
								completed: true,
								entered: true
							},
							{
								id: `${id}-s2`,
								type: 'normal',
								plannedReps: 5,
								weight: 80,
								reps: 5,
								rpe: 8.5,
								completed: true,
								grip: 'close'
							}
						]
					},
					{
						id: `${id}-x2`,
						exerciseId: 'chin-up',
						plannedAs: 'pull-up',
						sets: [
							{
								id: `${id}-s3`,
								type: 'failure',
								plannedReps: 8,
								weight: 0,
								reps: 9,
								rpe: null,
								completed: true,
								arms: 'both'
							}
						]
					}
				]
			}
		]
	};
}

const plan: Template = {
	id: 'push',
	name: 'Push "A", heavy',
	createdAt: day('2026-01-01'),
	entries: [
		{
			id: 'pe1',
			exercises: [
				{
					id: 'px1',
					exerciseId: 'bench-press',
					grip: 'close',
					restSeconds: null,
					sets: [{ id: 'ps1', plannedReps: 5 }]
				}
			]
		}
	],
	mark: { icon: 'push', colour: 'amber' },
	order: 1,
	archivedAt: null
};

async function filled(): Promise<Store> {
	const store = await freshStore();

	await store.finishWorkout(session('w1', day('2026-03-02')), day('2026-03-02', 10));
	await store.finishWorkout(session('w2', day('2026-04-10')), day('2026-04-10', 10));
	await store.finishWorkout(session('w3', day('2026-05-01')), day('2026-05-01', 10));
	await store.deleteWorkout('w3', day('2026-05-02'));
	await store.saveTemplate(plan, day('2026-01-01'));
	await store.saveBodyweight({ date: '2026-02-27', kg: 81.4 }, day('2026-02-27'));
	await store.saveBodyweight({ date: '2026-04-11', kg: 80.2 }, day('2026-04-11'));
	await store.setExertionScale('rir', 5);
	await store.setRestOverride('bench-press', 180, 6);
	await store.setPlanRest('push', null, 7);
	await store.setExerciseNote('bench-press', 'Elbows in', 8);
	await store.saveSnapshot({
		workout: session('live', day('2026-04-12')),
		activeSetId: 'live-s2',
		rest: { endsAt: 9000, seconds: 150, exerciseId: 'bench-press', name: 'Bench Press' },
		muted: false,
		dismissed: null
	});

	return store;
}

const finished = (w: Workout, finishedAt: number): FinishedWorkout =>
	Object.assign(w, { finishedAt });

const byId = (records: WireRecord[]): WireRecord[] =>
	records.toSorted((a, b) => (a.id < b.id ? -1 : 1));

describe('a backup round trip', () => {
	it('restores an identical store from an export, through a wipe', async () => {
		const store = await filled();
		const before = await store.exportContents();
		const text = JSON.stringify(backupOf(before, day('2026-04-12', 12)));

		await store.wipe(null);

		const wiped = await store.exportContents();

		expect(wiped.records).toEqual([]);

		const read = readBackup(text);

		if (!read.ok) {
			throw new Error(read.reason);
		}

		expect(await store.importContents(read.contents, day('2026-04-12', 13))).toEqual({
			written: before.records.length,
			kept: 0,
			session: 'restored'
		});

		const after = await store.exportContents();

		expect(byId(after.records)).toEqual(byId(before.records));
		expect(after.session).toEqual(before.session);

		const rest = await store.restSettings();

		expect(await store.listWorkouts()).toHaveLength(2);
		expect(await store.getWorkout('w3')).toBeNull();
		expect(await store.exertionScale()).toBe('rir');
		expect(rest.overrides).toEqual({ 'bench-press': 180 });
		expect(await store.planRest('push')).toBeNull();
		expect(await store.exerciseNote('bench-press')).toBe('Elbows in');
		expect(await store.listBodyweight()).toHaveLength(2);
		expect(await store.loadSnapshot()).toMatchObject({ activeSetId: 'live-s2' });
	});

	it('carries a retired slug as written, not as the fold reads it', async () => {
		const store = await filled();
		const { records } = await store.exportContents();
		const w1 = records.find((record) => record.id === 'w1');

		expect(w1).toMatchObject({
			payload: { entries: [{ exercises: [{}, { exerciseId: 'chin-up' }] }] }
		});
	});

	it('writes nothing, and leaves nothing to sync, when the backup is already here', async () => {
		const store = await filled();
		const contents = await store.exportContents();

		const dirty = await store.dirtyRecords();

		await store.acknowledge(dirty.map(({ id, updatedAt }) => ({ id, updatedAt })));

		const read = readBackup(JSON.stringify(backupOf(contents, 0)));

		if (!read.ok) {
			throw new Error(read.reason);
		}

		expect(await store.importContents(read.contents, 0)).toEqual({
			written: 0,
			kept: contents.records.length,
			session: 'kept'
		});
		expect(await store.dirtyRecords()).toEqual([]);
	});
});

describe('the backup file', () => {
	const contents: StoreContents = {
		records: [
			{
				id: 'w1',
				kind: 'workout',
				updatedAt: 1,
				deletedAt: null,
				payload: finished(session('w1', day('2026-03-02')), day('2026-03-02', 10))
			},
			{
				id: 'bodyweight-2026-02-27',
				kind: 'bodyweight',
				updatedAt: 1,
				deletedAt: null,
				payload: { date: '2026-02-27', kg: 81.4 }
			},
			{
				id: 'bodyweight-2026-05-03',
				kind: 'bodyweight',
				updatedAt: 1,
				deletedAt: null,
				payload: { date: '2026-05-03', kg: 80 }
			},
			{
				id: 'exertion-scale',
				kind: 'preference',
				updatedAt: 1,
				deletedAt: null,
				payload: { scale: 'rir' }
			}
		],
		session: null
	};

	const made = day('2026-05-04');

	const file = (patch: Record<string, unknown> = {}): string =>
		JSON.stringify(Object.assign(backupOf(contents, made), patch));

	it('says what it holds: counts per kind and the dates it spans', () => {
		expect(readBackup(file())).toEqual({
			ok: true,
			contents,
			summary: {
				workout: 1,
				template: 0,
				bodyweight: 2,
				preference: 1,
				session: false,
				from: '2026-02-27',
				to: '2026-05-03'
			}
		});
	});

	it('carries the format, the app version and when it was made', () => {
		const backup = backupOf(contents, Date.UTC(2026, 4, 4, 8));

		expect(backup).toMatchObject({
			kind: 'kilorep-backup',
			format: BACKUP_FORMAT,
			exportedAt: '2026-05-04T08:00:00.000Z'
		});
		expect(backup.appVersion).toMatch(/^\d+\.\d+\.\d+/u);
		expect(backupName(day('2026-05-04'))).toBe('kilorep-2026-05-04.json');
	});

	it('refuses a file from a newer format', () => {
		expect(readBackup(file({ format: BACKUP_FORMAT + 1 }))).toEqual({
			ok: false,
			reason: 'newer'
		});
	});

	it('refuses what is not a backup', () => {
		for (const text of ['', 'date,kg\r\n', '[]', '{"records":[]}', JSON.stringify({ kind: 'x' })]) {
			expect(readBackup(text)).toEqual({ ok: false, reason: 'not-backup' });
		}
	});

	it('refuses a damaged backup whole', () => {
		const damaged: Record<string, unknown>[] = [
			{ format: 0 },
			{ format: '1' },
			{ records: null },
			{ records: [{ id: 'x', kind: 'exercise', updatedAt: 1, deletedAt: null, payload: {} }] },
			{ records: [{ id: 'x', kind: 'workout', updatedAt: '1', deletedAt: null, payload: {} }] },
			{
				records: [
					...contents.records,
					{ id: 'w9', kind: 'workout', updatedAt: 1, deletedAt: null, payload: { id: 'w9' } }
				]
			},
			{
				records: [
					{
						id: 'w1',
						kind: 'workout',
						updatedAt: 1,
						deletedAt: null,
						payload: finished(session('w2', 0), 1)
					}
				]
			},
			{
				records: [
					{
						id: 'w1',
						kind: 'workout',
						updatedAt: 1,
						deletedAt: null,
						payload: {
							id: 'w1',
							startedAt: 0,
							finishedAt: 1,
							entries: [
								{
									id: 'e',
									exercises: [{ id: 'x', exerciseId: 'a', sets: [{ id: 's', weight: '80' }] }]
								}
							]
						}
					}
				]
			},
			{
				records: [
					{
						id: 'bodyweight-2026-01-01',
						kind: 'bodyweight',
						updatedAt: 1,
						deletedAt: null,
						payload: { date: '2026-01-02', kg: 80 }
					}
				]
			},
			{
				records: [
					{
						id: 'p',
						kind: 'template',
						updatedAt: 1,
						deletedAt: null,
						payload: { id: 'p', name: 'P' }
					}
				]
			},
			{ session: { workout: { id: 'live' }, activeSetId: null } }
		];

		for (const patch of damaged) {
			expect(readBackup(file(patch)), JSON.stringify(patch)).toEqual({
				ok: false,
				reason: 'damaged'
			});
		}
	});

	it('leaves tombstones out, and refuses a file with nothing else', () => {
		const tombstone = {
			id: 'w8',
			kind: 'workout',
			updatedAt: 5,
			deletedAt: 5,
			payload: { id: 'w8' }
		};

		const read = readBackup(file({ records: [...contents.records, tombstone] }));

		expect(read.ok && read.contents.records.map((record) => record.id)).toEqual(
			contents.records.map((record) => record.id)
		);
		expect(readBackup(file({ records: [tombstone] }))).toEqual({ ok: false, reason: 'empty' });
	});

	it('reads a session in flight on its own', () => {
		const live = {
			workout: session('live', day('2026-05-04')),
			activeSetId: null,
			rest: null,
			muted: false,
			dismissed: null
		};

		expect(readBackup(file({ records: [], session: live }))).toMatchObject({
			ok: true,
			summary: { workout: 0, session: true, from: null, to: null }
		});
	});

	it('reads records an older build wrote without the fields it did not know yet', () => {
		const sparse = {
			id: 'old',
			kind: 'workout',
			updatedAt: 1,
			deletedAt: null,
			payload: {
				id: 'old',
				startedAt: day('2025-12-28'),
				entries: [
					{
						id: 'e',
						exercises: [{ id: 'x', exerciseId: 'squat', sets: [{ id: 's', weight: 100, reps: 5 }] }]
					}
				]
			}
		};

		expect(readBackup(file({ records: [sparse] }))).toMatchObject({
			ok: true,
			summary: { workout: 1, from: '2025-12-28' }
		});
	});
});
