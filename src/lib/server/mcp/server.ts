import { McpServer } from '@modelcontextprotocol/server';

import { version } from '../../../../package.json';

import type { Database } from '../db/client.ts';
import { Library } from './library.ts';
import { registerTools } from './tools.ts';

const INSTRUCTIONS = `Kilorep is a workout logger: plans, sessions, sets and morning weigh-ins, all owned by one lifter.

Two things shape what you can do here.

Weight is never planned — a plan prescribes reps and the lifter decides the load on the day, so "what should I lift" is read out of history rather than out of a prescription. Volume counts completed working sets only, doubling per-hand and unilateral loads; a personal best is the heaviest weight ever moved on that exercise, not a formula.

A session in progress never leaves the phone. Workouts reach this server when the lifter taps FINISH, so history is complete up to the last finished session and silent about one happening right now. Never claim to know what is on the bar at this moment.

Writing is guarded rather than free. A record you mean to change is read first, and the write quotes the \`version\` that read handed back; a refusal means the record moved underneath you, so read it again rather than retrying with the same stamp. A write that replaces a tree — a plan's exercises, a session's sets — replaces all of it, so send back everything you meant to keep. Deleting is real and has no undo. Nothing here needs confirming twice, but nothing here should be guessed at either: resolve the record you mean before you change it.

Exercises are identified by catalogue ids like "bench-press". Resolve any movement the lifter names in prose through search_exercises before passing it anywhere else. A variation with its own load or emphasis is its own exercise linked by variantOf, and history never crosses between them. The catalogue is closed: it ships with the app, nothing here adds to it, and a movement it does not have is planned as the nearest one it does — say which substitution you made rather than searching for it a third way.

Ask for what you will read. Rows come back lean and name a fuller tool for the rest.`;

export function buildServer(db: Database, userId: string): McpServer {
	const server = new McpServer(
		{ name: 'kilorep', version },
		{ instructions: INSTRUCTIONS, capabilities: { tools: {} } }
	);

	registerTools(server, db, userId, new Library(db, userId));

	return server;
}
