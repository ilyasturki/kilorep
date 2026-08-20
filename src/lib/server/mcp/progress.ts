import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/server';

import { localDateOf, rollingAverage, weeklyRate, windowed } from '$lib/domain/bodyweight';
import { carriedOn } from '$lib/domain/load';
import {
	WEEK,
	estTrend,
	mainLifts,
	muscleSets,
	recentPrs,
	rollingConsistency,
	weeklyWork
} from '$lib/domain/progress';

import type { Tools } from './context.ts';
import { iso, reply, round, roundOrNull } from './format.ts';
import { exerciseOf, loadFactorOf, nameOf } from './library.ts';

/** The four weeks a personal best and a muscle count are read over, as on the Progress screen. */
const RECENT = 4 * WEEK;

/** Twelve weeks — long enough for an estimated-1RM line to say a direction. */
const TREND = 12 * WEEK;

export function registerProgress(server: McpServer, { library }: Tools): void {
	server.registerTool(
		'progress',
		{
			title: 'Progress',
			description:
				'The five things the Progress screen states, in one read: weekly tonnage and working sets over twelve weeks, personal bests set in the last four, the estimated-1RM direction on the main lifts, sessions in the last seven days against the lifter’s own median, working sets by muscle split direct from indirect, and the body-weight trend. Every window rolls back from now rather than from a Monday. These are the same functions the phone computes with, so the numbers match what the lifter sees.',
			inputSchema: z.object({}),
			annotations: { readOnlyHint: true }
		},
		() => {
			const now = Date.now();
			const workouts = library.workouts();
			const sessions = library.sessions();
			const carried = library.carried();

			const work = weeklyWork(workouts, now, loadFactorOf, carried);
			const lastWeek = work.at(-1);
			const habit = rollingConsistency(
				workouts.map((workout) => workout.startedAt),
				now
			);

			const lifts = mainLifts(sessions, now - TREND, loadFactorOf, carried).map((exerciseId) => {
				const trend = estTrend(
					sessions[exerciseId] ?? [],
					now - TREND,
					carriedOn(carried, exerciseId)
				);
				const first = trend.at(0);
				const last = trend.at(-1);
				const moved = first === undefined || last === undefined ? 0 : last.est - first.est;

				return {
					exerciseId,
					name: nameOf(exerciseId),
					est1rm: last === undefined ? null : round(last.est),
					deltaKg: round(moved),
					sessions: trend.length
				};
			});

			const muscles = muscleSets(workouts, now - RECENT, exerciseOf);
			// The card reads the last four weeks of the smoothed line, as the phone's does.
			const smoothed = rollingAverage(library.bodyweight());
			const line = windowed(smoothed, localDateOf(new Date()), 28);
			const latest = line.at(-1);

			return reply({
				weeklyWork: {
					weeks: work.map((week) => ({
						start: iso(week.start),
						kg: round(week.kg),
						sets: week.sets
					})),
					lastWeekKg: round(lastWeek === undefined ? 0 : lastWeek.kg)
				},
				strength: {
					recentPrs: recentPrs(sessions, now - RECENT, carried).map((pr) => ({
						exerciseId: pr.exerciseId,
						name: nameOf(pr.exerciseId),
						kg: round(pr.load),
						addedKg: pr.load === pr.set.weight ? undefined : pr.set.weight,
						reps: pr.set.reps,
						at: iso(pr.date)
					})),
					mainLifts: lifts
				},
				frequency: {
					last7: habit.last7,
					median: habit.median,
					weeks: habit.weeks
				},
				muscleSets: muscles
					.filter((row) => row.direct + row.indirect > 0)
					.map((row) => ({ muscle: row.muscle, direct: row.direct, indirect: row.indirect })),
				untrainedMuscles: muscles
					.filter((row) => row.direct + row.indirect === 0)
					.map((row) => row.muscle),
				// Not `latest`, which the bodyweight tool uses for the raw weigh-in: this is the
				// smoothed line the card states, and one name for two numbers is a trap.
				bodyweight: {
					averageKg: latest === undefined ? null : round(latest.kg),
					on: latest === undefined ? null : latest.date,
					weeklyRateKg: roundOrNull(weeklyRate(line))
				}
			});
		}
	);
}
