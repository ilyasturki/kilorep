import type { McpServer } from '@modelcontextprotocol/server';

import type { Database } from '../db/client.ts';
import type { Tools } from './context.ts';
import { registerExercises } from './exercises.ts';
import { registerHistory } from './history.ts';
import type { Library } from './library.ts';
import { registerPlans } from './plans.ts';
import { registerProgress } from './progress.ts';
import { registerWeight } from './weight.ts';
import { writeRecord } from './write.ts';

/**
 * The whole surface, one subject at a time.
 *
 * Grouped by what the lifter is asking about rather than by read against write: the tool that
 * answers "what did I lift" and the tool that corrects it are the same conversation, and a
 * file that holds both is where the wording of one can be checked against the other.
 */
export function registerTools(
	server: McpServer,
	db: Database,
	userId: string,
	library: Library
): void {
	const tools: Tools = {
		library,
		write: (request) => {
			const outcome = writeRecord(db, userId, request);

			if (outcome.ok) {
				library.invalidate();
			}

			return outcome;
		}
	};

	registerExercises(server, tools);
	registerHistory(server, tools);
	registerPlans(server, tools);
	registerProgress(server, tools);
	registerWeight(server, tools);
}
