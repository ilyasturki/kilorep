import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';

import { bodyweightId, localDateOf, rollingAverage, weeklyRate } from '$lib/domain/bodyweight';

import type { Tools } from './context.ts';
import { DATE, failed, refused, reply, round, roundOrNull } from './format.ts';

export function registerWeight(server: McpServer, { library, write }: Tools): void {
	server.registerTool(
		'bodyweight',
		{
			title: 'Body weight',
			description:
				'Morning weigh-ins with a seven-day rolling average and the weekly rate of change, oldest first. One entry per day. The average is computed across the whole series and only then windowed, so the first row of a range is not averaged from a standing start, and the rate is null until the rows actually returned span a fortnight — every number here is checkable against the rows beside it.',
			inputSchema: z.object({
				from: DATE.optional().describe('earliest day to include, inclusive'),
				to: DATE.optional().describe('latest day to include, inclusive'),
				limit: z
					.number()
					.int()
					.min(1)
					.max(400)
					.default(60)
					.describe('keeps the most recent this many')
			}),
			annotations: { readOnlyHint: true }
		},
		({ from, to, limit }) => {
			const all = library.bodyweight();
			const line = rollingAverage(all);

			const matched = all
				.map((entry, index) => ({
					date: entry.date,
					kg: entry.kg,
					average7: round(line[index].kg)
				}))
				.filter(
					(row) => (from === undefined || row.date >= from) && (to === undefined || row.date <= to)
				);

			const kept = matched.slice(-limit);
			// The rate reads the smoothed line, not the raw kg: a heavy dinner is not a trend.
			const smoothed = kept.map((row) => ({ date: row.date, kg: row.average7 }));

			return reply({
				logged: all.length,
				matched: matched.length,
				returned: kept.length,
				latest: all.at(-1) ?? null,
				weeklyRateKg: roundOrNull(weeklyRate(smoothed)),
				entries: kept
			});
		}
	);

	server.registerTool(
		'log_bodyweight',
		{
			title: 'Log body weight',
			description:
				'Record a morning weigh-in. One entry per day: logging a day that already has one overwrites it, which is the app’s own behaviour rather than a lost update.',
			inputSchema: z.object({
				kg: z.number().positive().max(500),
				date: DATE.optional().describe('defaults to today on the server clock')
			}),
			annotations: { idempotentHint: true }
		},
		({ kg, date }) => {
			const day = date ?? localDateOf(new Date());
			const entry = { date: day, kg: round(kg) };

			const outcome = write({
				id: bodyweightId(day),
				kind: 'bodyweight',
				payload: entry,
				expect: 'any'
			});

			if (failed(outcome)) {
				return refused(outcome);
			}

			// A write nobody can observe asks to be trusted; naming what it displaced does not.
			return reply({ logged: entry, replaced: outcome.previous });
		}
	);
}
