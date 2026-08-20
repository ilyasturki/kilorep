import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/server';
import { beforeEach, describe, expect, test } from 'vitest';

import { addDays, localDateOf } from '$lib/domain/bodyweight';
import type { WireRecord } from '$lib/sync/protocol';

import { createUser } from '../auth/accounts.ts';
import type { Database } from '../db/client.ts';
import { createDatabase } from '../db/client.ts';
import { runMigrations } from '../db/migrate.ts';
import { syncExchange } from '../db/sync.ts';
import { buildServer } from './server.ts';

let db: Database;
let userId: string;

const DAY = 86_400_000;

// A fixed clock: every assertion about windows and ordering reads from this, never from now.
const NOW = Date.UTC(2026, 7, 20, 9, 0, 0);

beforeEach(async () => {
	db = createDatabase(':memory:');
	runMigrations(db);
	const user = await createUser(db, 'lifter@example.com', 'a-long-enough-password');
	userId = user.id;
});

// `weight` and `reps` are nullable because a set the lifter never reached carries neither.
type SetSpec = {
	weight: number | null;
	reps: number | null;
	rpe?: number;
	warmup?: boolean;
	done?: boolean;
};

function workout(id: string, startedAt: number, exerciseId: string, sets: SetSpec[]): WireRecord {
	return {
		id,
		kind: 'workout',
		updatedAt: startedAt,
		deletedAt: null,
		payload: {
			id,
			templateId: null,
			startedAt,
			finishedAt: startedAt + 3_600_000,
			entries: [
				{
					id: `${id}-e`,
					exercises: [
						{
							id: `${id}-x`,
							exerciseId,
							sets: sets.map((set, index) => ({
								id: `${id}-s${index}`,
								type: set.warmup === true ? 'warmup' : 'normal',
								plannedReps: null,
								weight: set.weight,
								reps: set.reps,
								rpe: set.rpe ?? null,
								completed: set.done !== false
							}))
						}
					]
				}
			]
		}
	};
}

function weighIn(date: string, kg: number): WireRecord {
	return {
		id: `bodyweight-${date}`,
		kind: 'bodyweight',
		updatedAt: Date.parse(`${date}T06:00:00Z`),
		deletedAt: null,
		payload: { date, kg }
	};
}

function seed(...pushed: WireRecord[]): void {
	syncExchange(db, userId, { watermark: 0, push: pushed });
}

type Send = <T>(method: string, params?: unknown) => Promise<T>;

type ToolText = { content: { type: string; text: string }[] };

type ToolList = { tools: { name: string }[] };

type Handshake = { serverInfo: { name: string; version: string }; instructions: string };

type ExerciseRow = {
	id: string;
	lastSets: string | null;
	pr: { weight: number; reps: number; at: string } | null;
};

type Found = { matched: number; returned: number; exercises: ExerciseRow[] };

type Detail = {
	error?: string;
	note: string | null;
	restSeconds: number | null;
	trainedSessions: number;
	sessions: { est1rm: number; sets: { weight: number; reps: number; rpe: number | null }[] }[];
};

type WorkoutRow = { id: string; title: string; sets: number; volumeKg: number };

type Listed = { matched: number; returned: number; workouts: WorkoutRow[] };

type Logged = {
	logged?: { date: string; kg: number };
	replaced?: { date: string; kg: number } | null;
	error?: string;
};

type Weights = {
	logged: number;
	matched: number;
	returned: number;
	latest: { date: string; kg: number } | null;
	weeklyRateKg: number | null;
	entries: { date: string; kg: number; average7: number }[];
};

/** A live MCP connection over the same transport the route builds, handshake and all. */
async function connect(): Promise<Send> {
	const server = buildServer(db, userId);
	const transport = new WebStandardStreamableHTTPServerTransport({
		sessionIdGenerator: undefined,
		enableJsonResponse: true
	});

	await server.connect(transport);

	let nextId = 1;

	async function post(body: unknown): Promise<Response> {
		const response = await transport.handleRequest(
			new Request('http://kilorep.test/api/mcp', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					accept: 'application/json, text/event-stream'
				},
				body: JSON.stringify(body)
			})
		);

		return response;
	}

	const send = async <T>(method: string, params?: unknown): Promise<T> => {
		const response = await post({ jsonrpc: '2.0', id: nextId++, method, params: params ?? {} });

		expect(response.status).toBe(200);

		const message = (await response.json()) as { result?: T; error?: unknown };

		if (message.error !== undefined) {
			throw new Error(`${method} failed: ${JSON.stringify(message.error)}`);
		}

		return message.result as T;
	};

	await send<Handshake>('initialize', {
		protocolVersion: '2025-06-18',
		capabilities: {},
		clientInfo: { name: 'test', version: '0' }
	});

	await post({ jsonrpc: '2.0', method: 'notifications/initialized' });

	return send;
}

/** Tool results carry one JSON document as their only text block. */
async function callTool<T>(
	send: Send,
	name: string,
	args: Record<string, unknown> = {}
): Promise<T> {
	const result = await send<ToolText>('tools/call', { name, arguments: args });

	return JSON.parse(result.content[0].text) as T;
}

/**
 * One tool call on a server of its own, which is what the route builds per request.
 *
 * Most assertions want that shape rather than a long-lived connection: it is the one the
 * route actually has. A read after a write on a shared connection is tested separately,
 * because one POST can carry several calls and the memo has to drop behind each write.
 */
async function once<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
	const send = await connect();

	return callTool<T>(send, name, args);
}

type PlanSpec = {
	id: string;
	name: string;
	exercises: string[];
	order?: number;
	archivedAt?: number;
};

function plan(spec: PlanSpec): WireRecord {
	const payload: Record<string, unknown> = {
		id: spec.id,
		name: spec.name,
		createdAt: NOW - 60 * DAY,
		entries: spec.exercises.map((exerciseId, index) => ({
			id: `${spec.id}-e${index}`,
			exercises: [
				{
					id: `${spec.id}-x${index}`,
					exerciseId,
					sets: [0, 1, 2].map((n) => ({ id: `${spec.id}-s${index}-${n}`, plannedReps: 8 }))
				}
			]
		}))
	};

	if (spec.order !== undefined) {
		payload.order = spec.order;
	}

	if (spec.archivedAt !== undefined) {
		payload.archivedAt = spec.archivedAt;
	}

	return { id: spec.id, kind: 'template', updatedAt: NOW - 60 * DAY, deletedAt: null, payload };
}

type SessionSpec = {
	id: string;
	startedAt: number;
	minutes?: number;
	templateId?: string;
	exercises: { exerciseId: string; sets: (SetSpec & { plannedReps?: number })[] }[];
};

/** A finished session with more than one exercise in it — what the flat helper above cannot say. */
function session(spec: SessionSpec): WireRecord {
	return {
		id: spec.id,
		kind: 'workout',
		updatedAt: spec.startedAt,
		deletedAt: null,
		payload: {
			id: spec.id,
			templateId: spec.templateId ?? null,
			startedAt: spec.startedAt,
			finishedAt: spec.startedAt + (spec.minutes ?? 60) * 60_000,
			entries: spec.exercises.map((exercise, index) => ({
				id: `${spec.id}-e${index}`,
				exercises: [
					{
						id: `${spec.id}-x${index}`,
						exerciseId: exercise.exerciseId,
						sets: exercise.sets.map((set, n) => ({
							id: `${spec.id}-s${index}-${n}`,
							type: set.warmup === true ? 'warmup' : 'normal',
							plannedReps: set.plannedReps ?? null,
							weight: set.weight,
							reps: set.reps,
							rpe: set.rpe ?? null,
							completed: set.done !== false
						}))
					}
				]
			}))
		}
	};
}

type PlanRow = {
	id: string;
	version: number;
	name: string;
	archived: boolean;
	position: number | null;
	lastTrained: string | null;
	exercises: { exerciseId: string; group?: number; sets: (number | null)[] }[];
};

type Plans = {
	plans: PlanRow[];
	nextUp: { id: string; name: string } | null;
	archived: number;
};

type Saved = {
	id?: string;
	version?: number;
	name?: string;
	archived?: boolean;
	exercises?: { exerciseId: string; group?: number; sets: (number | null)[] }[];
	error?: string;
	deleted?: { id: string; name: string };
	sessionsLeftUnnamed?: number;
};

type SetRow = {
	weight: number | null;
	reps: number | null;
	type: string;
	rpe: number | null;
	completed: boolean;
	plannedReps: number | null;
};

type WorkoutDetail = {
	id: string;
	version: number;
	title: string;
	templateId: string | null;
	startedAt: string;
	minutes: number;
	totals: { exercises: number; completedSets: number; volumeKg: number };
	drift: { unplanned: string[]; missing: string[] } | null;
	exercises: {
		exerciseId: string;
		group?: number;
		drift?: { added: number; removed: number; retargeted: number };
		sets: SetRow[];
	}[];
	error?: string;
};

type Wrote = {
	id?: string;
	version?: number;
	startedAt?: string;
	minutes?: number;
	totals?: { exercises: number; completedSets: number; volumeKg: number };
	deleted?: { id: string; title: string };
	error?: string;
};

type Progress = {
	weeklyWork: { weeks: { start: string; kg: number; sets: number }[]; lastWeekKg: number };
	strength: {
		recentPrs: { exerciseId: string; weight: number; reps: number }[];
		mainLifts: { exerciseId: string; est1rm: number | null; deltaKg: number; sessions: number }[];
	};
	frequency: { last7: number; median: number | null; weeks: number[] };
	muscleSets: { muscle: string; direct: number; indirect: number }[];
	untrainedMuscles: string[];
	bodyweight: { averageKg: number | null; on: string | null; weeklyRateKg: number | null };
};

type Noted = { note?: string | null; replaced?: string | null; error?: string };

type Rested = {
	default?: { enabled: boolean; seconds: number };
	exerciseId?: string;
	inherits?: boolean;
	restSeconds?: number | null;
	error?: string;
};

describe('the surface', () => {
	test('lists the tools it means to answer for, and no others', async () => {
		const send = await connect();
		const listed = await send<ToolList>('tools/list');

		expect(listed.tools.map((tool) => tool.name).toSorted()).toEqual([
			'bodyweight',
			'delete_plan',
			'delete_workout',
			'edit_workout',
			'exercise',
			'log_bodyweight',
			'log_workout',
			'plans',
			'progress',
			'save_plan',
			'search_exercises',
			'set_exercise_note',
			'set_rest',
			'workout',
			'workouts'
		]);
	});

	test('carries instructions that name the constraint a caller cannot see', async () => {
		const server = buildServer(db, userId);
		const transport = new WebStandardStreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
			enableJsonResponse: true
		});

		await server.connect(transport);

		const response = await transport.handleRequest(
			new Request('http://kilorep.test/api/mcp', {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					accept: 'application/json, text/event-stream'
				},
				body: JSON.stringify({
					jsonrpc: '2.0',
					id: 1,
					method: 'initialize',
					params: {
						protocolVersion: '2025-06-18',
						capabilities: {},
						clientInfo: { name: 'test', version: '0' }
					}
				})
			})
		);

		const { result } = (await response.json()) as { result: Handshake };

		expect(result.serverInfo.name).toBe('kilorep');
		// The one thing a caller cannot work out from the tools: history stops at FINISH.
		expect(result.instructions).toContain('never leaves the phone');
	});
});

describe('search_exercises', () => {
	test('resolves prose to a catalogue id, fuzzily', async () => {
		const send = await connect();
		const found = await callTool<Found>(send, 'search_exercises', { query: 'bech pres', limit: 3 });

		expect(found.exercises[0].id).toBe('bench-press');
	});

	test('quotes the last session and the raw best from real history', async () => {
		seed(
			workout('w1', NOW - 14 * DAY, 'bench-press', [{ weight: 90, reps: 3 }]),
			workout('w2', NOW - 3 * DAY, 'bench-press', [{ weight: 82.5, reps: 7 }])
		);

		const send = await connect();
		const found = await callTool<Found>(send, 'search_exercises', {
			query: 'bench press',
			limit: 1
		});
		const bench = found.exercises[0];

		expect(bench.lastSets).toBe('82.5 × 7');
		expect(bench.pr).toEqual({ weight: 90, reps: 3, at: new Date(NOW - 14 * DAY).toISOString() });
	});

	test('trainedOnly drops the catalogue down to what has been lifted', async () => {
		seed(workout('w1', NOW - DAY, 'bench-press', [{ weight: 80, reps: 5 }]));

		const send = await connect();
		const found = await callTool<Found>(send, 'search_exercises', { trainedOnly: true, limit: 50 });

		expect(found.exercises.map((exercise) => exercise.id)).toEqual(['bench-press']);
	});
});

describe('exercise', () => {
	test('refuses an id the catalogue has never heard of', async () => {
		const send = await connect();
		const detail = await callTool<Detail>(send, 'exercise', { id: 'moon-press' });

		expect(detail.error).toContain('moon-press');
	});

	test('reports sessions set by set, newest last, with an estimated 1RM each', async () => {
		seed(
			workout('w1', NOW - 7 * DAY, 'bench-press', [
				{ weight: 40, reps: 10, warmup: true },
				{ weight: 80, reps: 5, rpe: 8 }
			])
		);

		const send = await connect();
		const detail = await callTool<Detail>(send, 'exercise', { id: 'bench-press' });

		// The warmup is excluded from history, as it is everywhere else.
		expect(detail.sessions).toHaveLength(1);
		expect(detail.sessions[0].sets).toEqual([{ weight: 80, reps: 5, rpe: 8 }]);
		expect(detail.sessions[0].est1rm).toBeCloseTo(93.33, 2);
		expect(detail.trainedSessions).toBe(1);
	});

	test('asking for no sessions gives none, rather than every one of them', async () => {
		seed(
			workout('w1', NOW - 7 * DAY, 'bench-press', [{ weight: 80, reps: 5 }]),
			workout('w2', NOW - 2 * DAY, 'bench-press', [{ weight: 85, reps: 5 }])
		);

		const send = await connect();
		const detail = await callTool<Detail>(send, 'exercise', { id: 'bench-press', sessions: 0 });

		expect(detail.sessions).toEqual([]);
		// The count still reports the whole history — only the transcript was declined.
		expect(detail.trainedSessions).toBe(2);
	});

	test('carries the standing note and the rest duration in force', async () => {
		seed(
			{
				id: 'note:bench-press',
				kind: 'preference',
				updatedAt: 1,
				deletedAt: null,
				payload: { text: 'seat 4, thumbs on the rings' }
			},
			{
				id: 'rest:bench-press',
				kind: 'preference',
				updatedAt: 1,
				deletedAt: null,
				payload: { seconds: 180 }
			}
		);

		const send = await connect();
		const detail = await callTool<Detail>(send, 'exercise', { id: 'bench-press' });

		expect(detail.note).toBe('seat 4, thumbs on the rings');
		expect(detail.restSeconds).toBe(180);
	});
});

describe('workouts', () => {
	test('counts volume over completed working sets, doubling a per-hand load', async () => {
		// Dumbbell Bench Press is per-hand: 30 × 10 × 2 hands = 600.
		seed(workout('w1', NOW - DAY, 'dumbbell-bench-press', [{ weight: 30, reps: 10 }]));

		const send = await connect();
		const listed = await callTool<Listed>(send, 'workouts');

		expect(listed.workouts[0].volumeKg).toBe(600);
		expect(listed.workouts[0].sets).toBe(1);
	});

	test('leaves an uncompleted set out of both the volume and the count', async () => {
		seed(
			workout('w1', NOW - DAY, 'bench-press', [
				{ weight: 80, reps: 5 },
				{ weight: 80, reps: 5, done: false }
			])
		);

		const send = await connect();
		const listed = await callTool<Listed>(send, 'workouts');

		expect(listed.workouts[0].volumeKg).toBe(400);
		expect(listed.workouts[0].sets).toBe(1);
	});

	test('returns newest first and honours a day window at both ends', async () => {
		seed(
			workout('old', Date.UTC(2026, 6, 1, 10), 'bench-press', [{ weight: 80, reps: 5 }]),
			workout('mid', Date.UTC(2026, 7, 10, 10), 'bench-press', [{ weight: 80, reps: 5 }]),
			workout('new', Date.UTC(2026, 7, 19, 10), 'bench-press', [{ weight: 80, reps: 5 }])
		);

		const send = await connect();
		const all = await callTool<Listed>(send, 'workouts');

		expect(all.workouts.map((row) => row.id)).toEqual(['new', 'mid', 'old']);

		const windowed = await callTool<Listed>(send, 'workouts', {
			from: '2026-08-01',
			to: '2026-08-15'
		});

		expect(windowed.workouts.map((row) => row.id)).toEqual(['mid']);
	});

	test('names a session after the exercises when no plan is behind it', async () => {
		seed(workout('w1', NOW - DAY, 'bench-press', [{ weight: 80, reps: 5 }]));

		const send = await connect();
		const listed = await callTool<Listed>(send, 'workouts');

		expect(listed.workouts[0].title).toBe('Bench Press');
	});
});

describe('log_bodyweight', () => {
	test('writes a weigh-in that syncs back out to a device', async () => {
		const send = await connect();
		const logged = await callTool<Logged>(send, 'log_bodyweight', { kg: 78.4, date: '2026-08-20' });

		expect(logged.logged).toEqual({ date: '2026-08-20', kg: 78.4 });

		const pulled = syncExchange(db, userId, { watermark: 0, push: [] });

		expect(pulled.records).toHaveLength(1);
		expect(pulled.records[0].id).toBe('bodyweight-2026-08-20');
		expect(pulled.records[0].payload).toEqual({ date: '2026-08-20', kg: 78.4 });
	});

	test('re-logging a day overwrites it, which is the app’s own rule', async () => {
		const send = await connect();

		await callTool<Logged>(send, 'log_bodyweight', { kg: 78.4, date: '2026-08-20' });
		await callTool<Logged>(send, 'log_bodyweight', { kg: 78.9, date: '2026-08-20' });

		const pulled = syncExchange(db, userId, { watermark: 0, push: [] });

		expect(pulled.records).toHaveLength(1);
		expect(pulled.records[0].payload).toEqual({ date: '2026-08-20', kg: 78.9 });
	});

	test('outruns a device clock that is ahead of the server', async () => {
		// A phone stamped tomorrow: a plain Date.now() write would silently lose to it.
		seed({
			id: 'bodyweight-2026-08-20',
			kind: 'bodyweight',
			updatedAt: Date.now() + DAY,
			deletedAt: null,
			payload: { date: '2026-08-20', kg: 80 }
		});

		const send = await connect();
		const logged = await callTool<Logged>(send, 'log_bodyweight', { kg: 78.4, date: '2026-08-20' });

		expect(logged.logged).toEqual({ date: '2026-08-20', kg: 78.4 });

		const pulled = syncExchange(db, userId, { watermark: 0, push: [] });

		expect(pulled.records[0].payload).toEqual({ date: '2026-08-20', kg: 78.4 });
	});

	test('refuses a weight outside anything a person weighs', async () => {
		const send = await connect();

		await expect(callTool(send, 'log_bodyweight', { kg: -5 })).rejects.toThrow();
	});
});

describe('one lifter, one library', () => {
	test('never reads another account records', async () => {
		const stranger = await createUser(db, 'stranger@example.com', 'a-long-enough-password');

		syncExchange(db, stranger.id, {
			watermark: 0,
			push: [workout('theirs', NOW - DAY, 'bench-press', [{ weight: 200, reps: 5 }])]
		});

		const send = await connect();
		const listed = await callTool<Listed>(send, 'workouts');

		expect(listed.workouts).toEqual([]);
	});
});

describe('bodyweight', () => {
	const rising = (): WireRecord[] =>
		Array.from({ length: 10 }, (_, index) =>
			weighIn(`2026-08-${String(index + 1).padStart(2, '0')}`, 80 + index)
		);

	test('reports the series oldest first, with the latest weigh-in named', async () => {
		seed(...rising());

		const send = await connect();
		const weights = await callTool<Weights>(send, 'bodyweight');

		expect(weights.logged).toBe(10);
		expect(weights.entries[0].date).toBe('2026-08-01');
		expect(weights.latest).toEqual({ date: '2026-08-10', kg: 89 });
	});

	test('averages across the whole series and windows after, not before', async () => {
		seed(...rising());

		const send = await connect();
		const weights = await callTool<Weights>(send, 'bodyweight', { from: '2026-08-08' });

		// 8 Aug averages 2–8 Aug (81…87 → 84). Windowing first would leave it averaging itself, 87.
		expect(weights.entries[0]).toEqual({ date: '2026-08-08', kg: 87, average7: 84 });
		expect(weights.matched).toBe(3);
		expect(weights.logged).toBe(10);
	});

	test('holds the weekly rate back until the window spans a fortnight', async () => {
		seed(...rising());

		const send = await connect();
		const short = await callTool<Weights>(send, 'bodyweight');

		expect(short.weeklyRateKg).toBeNull();

		const flat = Array.from({ length: 21 }, (_, index) =>
			weighIn(`2026-09-${String(index + 1).padStart(2, '0')}`, 80)
		);

		seed(...flat);

		const send2 = await connect();
		const long = await callTool<Weights>(send2, 'bodyweight', { from: '2026-09-01' });

		expect(long.weeklyRateKg).toBe(0);
	});

	test('keeps the most recent when the limit bites, and says so', async () => {
		seed(...rising());

		const send = await connect();
		const weights = await callTool<Weights>(send, 'bodyweight', { limit: 2 });

		expect(weights.returned).toBe(2);
		expect(weights.matched).toBe(10);
		expect(weights.entries.map((row) => row.date)).toEqual(['2026-08-09', '2026-08-10']);
	});
});

describe('a write that can be observed', () => {
	test('a read after a write on the same connection sees the write', async () => {
		// One POST can carry a batch of calls, so the memoised view has to drop behind a write
		// rather than answer the next read from before it.
		const send = await connect();

		await callTool<Weights>(send, 'bodyweight');
		await callTool<Logged>(send, 'log_bodyweight', { kg: 78.4, date: '2026-08-20' });

		const after = await callTool<Weights>(send, 'bodyweight');

		expect(after.logged).toBe(1);
		expect(after.entries).toEqual([{ date: '2026-08-20', kg: 78.4, average7: 78.4 }]);
	});

	test('names nothing displaced when the day was empty', async () => {
		const send = await connect();
		const logged = await callTool<Logged>(send, 'log_bodyweight', {
			kg: 78.4,
			date: '2026-08-20'
		});

		expect(logged.replaced).toBeNull();
	});

	test('names what it overwrote when the day already had a weigh-in', async () => {
		seed(weighIn('2026-08-20', 80.1));

		const send = await connect();
		const logged = await callTool<Logged>(send, 'log_bodyweight', {
			kg: 78.4,
			date: '2026-08-20'
		});

		expect(logged.logged).toEqual({ date: '2026-08-20', kg: 78.4 });
		expect(logged.replaced).toEqual({ date: '2026-08-20', kg: 80.1 });
	});
});

describe('plans', () => {
	test('keeps the order they were dragged into, and names the one that is next', async () => {
		seed(
			plan({ id: 'p1', name: 'Push', exercises: ['bench-press'], order: 1000 }),
			plan({ id: 'p2', name: 'Pull', exercises: ['barbell-row'], order: 2000 }),
			plan({ id: 'p3', name: 'Legs', exercises: ['squat'], order: 3000 }),
			session({
				id: 'w1',
				startedAt: NOW - 2 * DAY,
				templateId: 'p1',
				exercises: [{ exerciseId: 'bench-press', sets: [{ weight: 80, reps: 5 }] }]
			})
		);

		const listed = await once<Plans>('plans');

		expect(listed.plans.map((row) => row.id)).toEqual(['p1', 'p2', 'p3']);
		expect(listed.plans.map((row) => row.position)).toEqual([0, 1, 2]);
		// Push was trained last, so the rotation is standing on Pull.
		expect(listed.nextUp).toEqual({ id: 'p2', name: 'Pull' });
		expect(listed.plans[0].lastTrained).toBe(new Date(NOW - 2 * DAY).toISOString());
	});

	test('leaves archived plans out of the list it hands back, and counts them', async () => {
		seed(
			plan({ id: 'p1', name: 'Push', exercises: ['bench-press'], order: 1000 }),
			plan({ id: 'old', name: 'v1 Push', exercises: ['bench-press'], order: 500, archivedAt: NOW })
		);

		const listed = await once<Plans>('plans');

		expect(listed.plans.map((row) => row.id)).toEqual(['p1']);
		expect(listed.archived).toBe(1);

		const all = await once<Plans>('plans', { includeArchived: true });

		expect(all.plans.map((row) => row.id)).toEqual(['old', 'p1']);
		// Archived plans hold no position: nothing can start them.
		expect(all.plans[0].position).toBeNull();
	});

	test('prescribes reps and never a weight', async () => {
		seed(plan({ id: 'p1', name: 'Push', exercises: ['bench-press'] }));

		const listed = await once<Plans>('plans');
		const [exercise] = listed.plans[0].exercises;

		expect(exercise.sets).toEqual([8, 8, 8]);
		expect(JSON.stringify(exercise)).not.toContain('weight');
	});
});

describe('writing a plan', () => {
	test('creates one, and it lands at the end of the rotation', async () => {
		seed(plan({ id: 'p1', name: 'Push', exercises: ['bench-press'], order: 1000 }));

		const saved = await once<Saved>('save_plan', {
			name: 'Legs',
			exercises: [
				{ exerciseId: 'squat', sets: [5, 5, 5] },
				{ exerciseId: 'leg-press', sets: [10, 10] }
			]
		});

		expect(saved.error).toBeUndefined();
		expect(saved.name).toBe('Legs');

		const listed = await once<Plans>('plans');

		expect(listed.plans.map((row) => row.name)).toEqual(['Push', 'Legs']);
		expect(listed.plans[1].exercises.map((row) => row.sets)).toEqual([
			[5, 5, 5],
			[10, 10]
		]);
	});

	test('refuses a plan with no name and no exercises', async () => {
		const saved = await once<Saved>('save_plan', { name: '   ' });

		expect(saved.error).toContain('never saved');
	});

	test('refuses an edit that quotes a version the record has moved past', async () => {
		seed(plan({ id: 'p1', name: 'Push', exercises: ['bench-press'] }));

		const listed = await once<Plans>('plans');
		const stale = listed.plans[0].version;

		await once<Saved>('save_plan', { id: 'p1', version: stale, name: 'Push A' });
		const second = await once<Saved>('save_plan', { id: 'p1', version: stale, name: 'Push B' });

		expect(second.error).toContain('changed since you read it');

		const after = await once<Plans>('plans');

		expect(after.plans[0].name).toBe('Push A');
	});

	test('carries over everything the edit does not mention', async () => {
		seed(plan({ id: 'p1', name: 'Push', exercises: ['bench-press', 'overhead-press'] }));

		const before = await once<Plans>('plans');

		await once<Saved>('save_plan', {
			id: 'p1',
			version: before.plans[0].version,
			name: 'Push A'
		});

		const after = await once<Plans>('plans');

		expect(after.plans[0].name).toBe('Push A');
		expect(after.plans[0].exercises.map((row) => row.exerciseId)).toEqual([
			'bench-press',
			'overhead-press'
		]);
	});

	test('a superset is said with a shared group number, and reads back as one', async () => {
		await once<Saved>('save_plan', {
			name: 'Arms',
			exercises: [
				{ exerciseId: 'barbell-curl', group: 1, sets: [10, 10] },
				{ exerciseId: 'triceps-pushdown', group: 1, sets: [10, 10] },
				{ exerciseId: 'hammer-curl', sets: [12] }
			]
		});

		const listed = await once<Plans>('plans');
		const rows = listed.plans[0].exercises;

		expect(rows.map((row) => row.group)).toEqual([1, 1, undefined]);
	});

	test('archiving retires a plan without taking the name it lends old sessions', async () => {
		seed(
			plan({ id: 'p1', name: 'Push A', exercises: ['bench-press'] }),
			session({
				id: 'w1',
				startedAt: NOW - DAY,
				templateId: 'p1',
				exercises: [{ exerciseId: 'bench-press', sets: [{ weight: 80, reps: 5 }] }]
			})
		);

		const before = await once<Plans>('plans');

		await once<Saved>('save_plan', {
			id: 'p1',
			version: before.plans[0].version,
			archived: true
		});

		const listed = await once<Listed>('workouts');

		expect(listed.workouts[0].title).toBe('Push A');

		const plans = await once<Plans>('plans');

		expect(plans.plans).toEqual([]);
		expect(plans.nextUp).toBeNull();
	});

	test('a position moves what trains next', async () => {
		seed(
			plan({ id: 'p1', name: 'Push', exercises: ['bench-press'], order: 1000 }),
			plan({ id: 'p2', name: 'Pull', exercises: ['barbell-row'], order: 2000 }),
			plan({ id: 'p3', name: 'Legs', exercises: ['squat'], order: 3000 }),
			session({
				id: 'w1',
				startedAt: NOW - DAY,
				templateId: 'p1',
				exercises: [{ exerciseId: 'bench-press', sets: [{ weight: 80, reps: 5 }] }]
			})
		);

		const before = await once<Plans>('plans');

		expect(before.nextUp).toEqual({ id: 'p2', name: 'Pull' });

		const pull = before.plans[1];

		await once<Saved>('save_plan', { id: 'p2', version: pull.version, position: 2 });

		const after = await once<Plans>('plans');

		expect(after.plans.map((row) => row.id)).toEqual(['p1', 'p3', 'p2']);
		// Push is still the anchor; the plan after it is Legs now.
		expect(after.nextUp).toEqual({ id: 'p3', name: 'Legs' });
	});

	test('unarchiving and repositioning in one save puts the plan back where it was asked for', async () => {
		seed(
			plan({ id: 'p1', name: 'Push', exercises: ['bench-press'], order: 1000 }),
			plan({ id: 'p2', name: 'Pull', exercises: ['barbell-row'], order: 2000 }),
			plan({ id: 'old', name: 'Legs', exercises: ['squat'], order: 500, archivedAt: NOW })
		);

		const before = await once<Plans>('plans', { includeArchived: true });
		// Rank 500 puts the archived plan first in the list that includes it.
		const [archived] = before.plans;

		expect(archived.id).toBe('old');

		// The move is only possible because the same call unarchives it, so reordering has to
		// read the rotation this save leaves rather than the one it found.
		const saved = await once<Saved>('save_plan', {
			id: 'old',
			version: archived.version,
			archived: false,
			position: 2
		});

		expect(saved.error).toBeUndefined();

		const after = await once<Plans>('plans');

		expect(after.plans.map((row) => row.id)).toEqual(['p1', 'p2', 'old']);
	});

	test('refuses an exercise the catalogue has never heard of', async () => {
		const saved = await once<Saved>('save_plan', {
			name: 'Nonsense',
			exercises: [{ exerciseId: 'kettlebell-juggling', sets: [8] }]
		});

		expect(saved.error).toContain('kettlebell-juggling');
	});

	test('deleting says how many sessions lose the name they resolved through it', async () => {
		seed(
			plan({ id: 'p1', name: 'Push A', exercises: ['bench-press'] }),
			session({
				id: 'w1',
				startedAt: NOW - DAY,
				templateId: 'p1',
				exercises: [{ exerciseId: 'bench-press', sets: [{ weight: 80, reps: 5 }] }]
			})
		);

		const before = await once<Plans>('plans');
		const gone = await once<Saved>('delete_plan', {
			id: 'p1',
			version: before.plans[0].version
		});

		expect(gone.deleted).toEqual({ id: 'p1', name: 'Push A' });
		expect(gone.sessionsLeftUnnamed).toBe(1);

		const listed = await once<Listed>('workouts');

		expect(listed.workouts[0].title).not.toBe('Push A');
	});
});

describe('one session in detail', () => {
	test('names how the session drifted from the plan it ran', async () => {
		seed(
			plan({ id: 'p1', name: 'Push', exercises: ['bench-press', 'squat'] }),
			session({
				id: 'w1',
				startedAt: NOW - DAY,
				templateId: 'p1',
				exercises: [
					{
						exerciseId: 'bench-press',
						sets: [
							{ weight: 80, reps: 8, plannedReps: 8 },
							{ weight: 80, reps: 8, plannedReps: 8 },
							{ weight: 80, reps: 8, plannedReps: 8 },
							{ weight: 75, reps: 8, plannedReps: 8 }
						]
					},
					{ exerciseId: 'barbell-row', sets: [{ weight: 60, reps: 10, plannedReps: 10 }] }
				]
			})
		);

		const detail = await once<WorkoutDetail>('workout', { id: 'w1' });

		expect(detail.drift).toEqual({ unplanned: ['barbell-row'], missing: ['squat'] });
		expect(detail.exercises[0].drift).toEqual({ added: 1, removed: 0, retargeted: 0 });
		expect(detail.totals.completedSets).toBe(5);
		expect(detail.minutes).toBe(60);
	});

	test('hands out the version an edit has to quote', async () => {
		seed(
			session({
				id: 'w1',
				startedAt: NOW - DAY,
				exercises: [{ exerciseId: 'bench-press', sets: [{ weight: 80, reps: 5 }] }]
			})
		);

		const detail = await once<WorkoutDetail>('workout', { id: 'w1' });

		expect(detail.version).toBe(NOW - DAY);
		expect(detail.drift).toBeNull();
	});
});

describe('logging a session that already happened', () => {
	test('writes it into history, counted the way the phone would count it', async () => {
		const wrote = await once<Wrote>('log_workout', {
			date: '2026-08-18',
			startedAt: '18:30',
			minutes: 55,
			exercises: [
				{
					exerciseId: 'dumbbell-bench-press',
					sets: [
						{ weight: 30, reps: 10 },
						{ weight: 30, reps: 8 }
					]
				}
			]
		});

		expect(wrote.error).toBeUndefined();
		// Per-hand: (30 × 10 + 30 × 8) × 2.
		expect(wrote.totals).toEqual({ exercises: 1, completedSets: 2, volumeKg: 1080 });

		const detail = await once<WorkoutDetail>('workout', { id: wrote.id ?? '' });

		expect(detail.minutes).toBe(55);
		expect(detail.exercises[0].sets.every((set) => set.completed)).toBe(true);
		expect(detail.startedAt).toBe(new Date(2026, 7, 18, 18, 30).toISOString());
	});

	test('a session that ran a plan moves the rotation', async () => {
		seed(
			plan({ id: 'p1', name: 'Push', exercises: ['bench-press'], order: 1000 }),
			plan({ id: 'p2', name: 'Pull', exercises: ['barbell-row'], order: 2000 })
		);

		const before = await once<Plans>('plans');

		// Untrained, the rotation reads from its own head.
		expect(before.nextUp).toEqual({ id: 'p1', name: 'Push' });

		await once<Wrote>('log_workout', {
			date: '2026-08-19',
			templateId: 'p1',
			exercises: [{ exerciseId: 'bench-press', sets: [{ weight: 80, reps: 5 }] }]
		});

		const after = await once<Plans>('plans');

		expect(after.nextUp).toEqual({ id: 'p2', name: 'Pull' });
	});

	test('refuses a day and a time that do not exist rather than rolling onto ones that do', async () => {
		const send = await connect();
		const lift = [{ exerciseId: 'bench-press', sets: [{ weight: 80, reps: 5 }] }];

		// Left to the Date constructor, 30 February settles on 2 March and 99:99 four days on.
		await expect(
			callTool(send, 'log_workout', { date: '2026-02-30', exercises: lift })
		).rejects.toThrow();
		await expect(
			callTool(send, 'log_workout', { date: '2026-13-45', exercises: lift })
		).rejects.toThrow();
		await expect(
			callTool(send, 'log_workout', { date: '2026-08-20', startedAt: '99:99', exercises: lift })
		).rejects.toThrow();

		// A real leap day is still a day.
		const leap = await callTool<Wrote>(send, 'log_workout', {
			date: '2028-02-29',
			exercises: lift
		});

		expect(leap.error).toBeUndefined();
	});

	test('refuses a plan and an exercise it cannot resolve', async () => {
		const unknownExercise = await once<Wrote>('log_workout', {
			date: '2026-08-19',
			exercises: [{ exerciseId: 'not-a-lift', sets: [{ weight: 80, reps: 5 }] }]
		});

		expect(unknownExercise.error).toContain('not-a-lift');

		const unknownPlan = await once<Wrote>('log_workout', {
			date: '2026-08-19',
			templateId: 'nope',
			exercises: [{ exerciseId: 'bench-press', sets: [{ weight: 80, reps: 5 }] }]
		});

		expect(unknownPlan.error).toBe('no plan nope');
	});
});

describe('correcting a session', () => {
	test('a FINISH that never got tapped is repaired by naming the minutes', async () => {
		seed(
			session({
				id: 'w1',
				startedAt: NOW - 2 * DAY,
				minutes: 21 * 60 + 30,
				exercises: [{ exerciseId: 'bench-press', sets: [{ weight: 80, reps: 5 }] }]
			})
		);

		const before = await once<WorkoutDetail>('workout', { id: 'w1' });

		expect(before.minutes).toBe(1290);

		const edited = await once<Wrote>('edit_workout', {
			id: 'w1',
			version: before.version,
			minutes: 75
		});

		expect(edited.minutes).toBe(75);

		const after = await once<WorkoutDetail>('workout', { id: 'w1' });

		expect(after.minutes).toBe(75);
		expect(after.startedAt).toBe(before.startedAt);
		expect(after.totals).toEqual(before.totals);
	});

	test('moving a session to another day keeps how long it took', async () => {
		seed(
			session({
				id: 'w1',
				startedAt: NOW - 2 * DAY,
				minutes: 45,
				exercises: [{ exerciseId: 'bench-press', sets: [{ weight: 80, reps: 5 }] }]
			})
		);

		const before = await once<WorkoutDetail>('workout', { id: 'w1' });

		await once<Wrote>('edit_workout', { id: 'w1', version: before.version, date: '2026-08-01' });

		const after = await once<WorkoutDetail>('workout', { id: 'w1' });

		expect(after.minutes).toBe(45);
		expect(after.startedAt.slice(0, 10)).toBe('2026-08-01');
	});

	test('the sets sent replace the whole tree, and the rest is carried over', async () => {
		seed(
			session({
				id: 'w1',
				startedAt: NOW - DAY,
				templateId: 'p1',
				exercises: [
					{ exerciseId: 'bench-press', sets: [{ weight: 8, reps: 5 }] },
					{ exerciseId: 'barbell-row', sets: [{ weight: 60, reps: 10 }] }
				]
			})
		);

		const before = await once<WorkoutDetail>('workout', { id: 'w1' });

		await once<Wrote>('edit_workout', {
			id: 'w1',
			version: before.version,
			exercises: [{ exerciseId: 'bench-press', sets: [{ weight: 80, reps: 5 }] }]
		});

		const after = await once<WorkoutDetail>('workout', { id: 'w1' });

		expect(after.exercises.map((row) => row.exerciseId)).toEqual(['bench-press']);
		expect(after.exercises[0].sets[0].weight).toBe(80);
		expect(after.templateId).toBe('p1');
	});

	test('a set never performed reads back as null and is taken straight back', async () => {
		seed(
			session({
				id: 'w1',
				startedAt: NOW - DAY,
				exercises: [
					{
						exerciseId: 'bench-press',
						sets: [
							{ weight: 80, reps: 8 },
							// The set the plan laid out and the lifter never reached.
							{ weight: null, reps: null, done: false }
						]
					}
				]
			})
		);

		const before = await once<WorkoutDetail>('workout', { id: 'w1' });

		expect(before.exercises[0].sets[1]).toMatchObject({
			weight: null,
			reps: null,
			completed: false
		});

		// The tree the read handed over is the tree the write takes — nulls and all, or a
		// session with an unfinished set could never be corrected at all.
		const edited = await once<Wrote>('edit_workout', {
			id: 'w1',
			version: before.version,
			exercises: before.exercises
		});

		expect(edited.error).toBeUndefined();

		const after = await once<WorkoutDetail>('workout', { id: 'w1' });

		expect(after.exercises[0].sets).toEqual(before.exercises[0].sets);
	});

	test('a set called completed still has to carry its numbers', async () => {
		const send = await connect();

		await expect(
			callTool(send, 'log_workout', {
				date: '2026-08-19',
				exercises: [
					{ exerciseId: 'bench-press', sets: [{ weight: null, reps: null, completed: true }] }
				]
			})
		).rejects.toThrow();
	});

	test('refuses an edit that quotes a version the record has moved past', async () => {
		seed(
			session({
				id: 'w1',
				startedAt: NOW - DAY,
				exercises: [{ exerciseId: 'bench-press', sets: [{ weight: 80, reps: 5 }] }]
			})
		);

		const before = await once<WorkoutDetail>('workout', { id: 'w1' });

		await once<Wrote>('edit_workout', { id: 'w1', version: before.version, minutes: 50 });
		const second = await once<Wrote>('edit_workout', {
			id: 'w1',
			version: before.version,
			minutes: 90
		});

		expect(second.error).toContain('changed since you read it');

		const after = await once<WorkoutDetail>('workout', { id: 'w1' });

		expect(after.minutes).toBe(50);
	});

	test('deleting a session takes the personal best it carried with it', async () => {
		seed(
			session({
				id: 'light',
				startedAt: NOW - 10 * DAY,
				exercises: [{ exerciseId: 'bench-press', sets: [{ weight: 80, reps: 5 }] }]
			}),
			session({
				id: 'heavy',
				startedAt: NOW - 2 * DAY,
				exercises: [{ exerciseId: 'bench-press', sets: [{ weight: 95, reps: 3 }] }]
			})
		);

		const before = await once<Found>('search_exercises', { query: 'bench press', limit: 1 });

		expect(before.exercises[0].pr).toMatchObject({ weight: 95, reps: 3 });

		const detail = await once<WorkoutDetail>('workout', { id: 'heavy' });
		const gone = await once<Wrote>('delete_workout', { id: 'heavy', version: detail.version });

		expect(gone.deleted).toMatchObject({ id: 'heavy' });

		const after = await once<Found>('search_exercises', { query: 'bench press', limit: 1 });

		expect(after.exercises[0].pr).toMatchObject({ weight: 80, reps: 5 });

		const missing = await once<WorkoutDetail>('workout', { id: 'heavy' });

		expect(missing.error).toBe('no workout heavy');
	});
});

describe('progress', () => {
	test('states the five things the screen states, over windows rolling back from now', async () => {
		const today = Date.now();

		seed(
			session({
				id: 'older',
				startedAt: today - 10 * DAY,
				exercises: [{ exerciseId: 'bench-press', sets: [{ weight: 80, reps: 5 }] }]
			}),
			session({
				id: 'recent',
				startedAt: today - 2 * DAY,
				exercises: [{ exerciseId: 'bench-press', sets: [{ weight: 90, reps: 5 }] }]
			})
		);

		const progress = await once<Progress>('progress');

		expect(progress.weeklyWork.weeks).toHaveLength(12);
		expect(progress.weeklyWork.lastWeekKg).toBe(450);
		expect(progress.frequency.last7).toBe(1);

		expect(progress.strength.recentPrs[0]).toMatchObject({
			exerciseId: 'bench-press',
			weight: 90,
			reps: 5
		});

		const [lift] = progress.strength.mainLifts;

		expect(lift.exerciseId).toBe('bench-press');
		expect(lift.est1rm).toBe(105);
		expect(lift.deltaKg).toBeCloseTo(11.67, 2);
		expect(lift.sessions).toBe(2);

		const chest = progress.muscleSets.find((row) => row.muscle === 'Chest');

		expect(chest).toEqual({ muscle: 'Chest', direct: 2, indirect: 0 });
		expect(progress.untrainedMuscles).toContain('Quads');
		expect(progress.bodyweight.averageKg).toBeNull();
	});

	test('reads the smoothed line for body weight, not the morning it was weighed', async () => {
		// Seeded off the real clock, because the card's window rolls back from now: fixed dates
		// would sit a month behind today by autumn and take the assertion red with them.
		const today = localDateOf(new Date());

		seed(weighIn(addDays(today, -2), 81), weighIn(addDays(today, -1), 79), weighIn(today, 80));

		const progress = await once<Progress>('progress');

		// The card states the average, as the phone's does: 81, 79 and 80 average 80.
		expect(progress.bodyweight.averageKg).toBe(80);
		expect(progress.bodyweight.on).toBe(today);
	});

	test('says nothing rather than dividing by an empty history', async () => {
		const progress = await once<Progress>('progress');

		expect(progress.weeklyWork.lastWeekKg).toBe(0);
		expect(progress.frequency.median).toBeNull();
		expect(progress.strength.recentPrs).toEqual([]);
		expect(progress.muscleSets).toEqual([]);
		expect(progress.bodyweight.weeklyRateKg).toBeNull();
	});
});

describe('notes and rest', () => {
	test('a note is written, read back on the exercise, and cleared', async () => {
		const first = await once<Noted>('set_exercise_note', {
			id: 'bench-press',
			text: 'Seat notch 4, thumbs on the rings'
		});

		expect(first).toEqual({ note: 'Seat notch 4, thumbs on the rings', replaced: null });

		const detail = await once<Detail>('exercise', { id: 'bench-press' });

		expect(detail.note).toBe('Seat notch 4, thumbs on the rings');

		const second = await once<Noted>('set_exercise_note', { id: 'bench-press', text: 'Notch 5' });

		expect(second.replaced).toBe('Seat notch 4, thumbs on the rings');

		const cleared = await once<Noted>('set_exercise_note', { id: 'bench-press', text: '' });

		expect(cleared).toEqual({ note: null, replaced: 'Notch 5' });

		const after = await once<Detail>('exercise', { id: 'bench-press' });

		expect(after.note).toBeNull();
	});

	test('an override wins over the default, and clearing it inherits again', async () => {
		await once<Rested>('set_rest', { seconds: 90 });

		const inherited = await once<Detail>('exercise', { id: 'bench-press' });

		expect(inherited.restSeconds).toBe(90);

		await once<Rested>('set_rest', { exerciseId: 'bench-press', seconds: 210 });

		const overridden = await once<Detail>('exercise', { id: 'bench-press' });

		expect(overridden.restSeconds).toBe(210);

		const cleared = await once<Rested>('set_rest', { exerciseId: 'bench-press' });

		expect(cleared).toEqual({ exerciseId: 'bench-press', inherits: true, restSeconds: 90 });

		const back = await once<Detail>('exercise', { id: 'bench-press' });

		expect(back.restSeconds).toBe(90);
	});

	test('never-rest is something an exercise says and the default cannot', async () => {
		const never = await once<Rested>('set_rest', { exerciseId: 'bench-press', seconds: null });

		expect(never.restSeconds).toBeNull();

		const detail = await once<Detail>('exercise', { id: 'bench-press' });

		expect(detail.restSeconds).toBeNull();

		const refused = await once<Rested>('set_rest', { seconds: null });

		expect(refused.error).toContain('enabled: false');
	});
});
