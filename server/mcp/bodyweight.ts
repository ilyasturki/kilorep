import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import {
    parseBodyweightInput,
    upsertBodyweight,
} from '~~/server/utils/bodyweight'
import { and, desc, eq, tables, useDrizzle } from '~~/server/utils/drizzle'
import { badRequest } from '~~/server/utils/http'
import { formatDate, run } from './helpers'

export function registerBodyweightTools(server: McpServer, userId: number) {
    server.registerTool(
        'log_bodyweight',
        {
            title: 'Log bodyweight',
            description:
                'Record a bodyweight weigh-in in kilograms — one per day; logging the same date again overwrites it.',
            inputSchema: {
                weight: z.number().describe('Bodyweight in kg'),
                date: z
                    .string()
                    .optional()
                    .describe(
                        'Day weighed as YYYY-MM-DD; defaults to today (server time)',
                    ),
            },
            annotations: { destructiveHint: false, idempotentHint: true },
        },
        (input) =>
            run(() => {
                const date = input.date ?? formatDate(new Date())
                const row = upsertBodyweight(
                    userId,
                    parseBodyweightInput({ date, weight: input.weight }),
                )
                return `Logged ${row.weight}kg on ${row.date}`
            }),
    )

    server.registerTool(
        'get_bodyweight_log',
        {
            title: 'Bodyweight log',
            description:
                'Recent weigh-ins, newest first, with the trend over the returned window.',
            inputSchema: {
                limit: z
                    .number()
                    .int()
                    .positive()
                    .optional()
                    .describe('How many weigh-ins (default 30)'),
            },
            annotations: { readOnlyHint: true },
        },
        (input) =>
            run(() => {
                const rows = useDrizzle()
                    .select()
                    .from(tables.bodyweight)
                    .where(eq(tables.bodyweight.userId, userId))
                    .orderBy(desc(tables.bodyweight.date))
                    .limit(input.limit ?? 30)
                    .all()
                if (rows.length === 0) return 'No weigh-ins logged yet.'

                const weights = rows.map((row) => row.weight)
                const latest = rows[0]!
                const oldest = rows[rows.length - 1]!
                const delta =
                    Math.round((latest.weight - oldest.weight) * 100) / 100
                const lines = rows.map((row) => `${row.date}: ${row.weight}kg`)
                lines.push(
                    `Trend ${oldest.date} → ${latest.date}: ${delta >= 0 ? '+' : ''}${delta}kg `
                        + `(min ${Math.min(...weights)}kg, max ${Math.max(...weights)}kg)`,
                )
                return lines.join('\n')
            }),
    )

    server.registerTool(
        'delete_bodyweight',
        {
            title: 'Delete a weigh-in',
            description:
                'Permanently delete the weigh-in of a given day. Use to undo a weigh-in logged by mistake.',
            inputSchema: {
                date: z.string().describe('Day to delete, as YYYY-MM-DD'),
            },
            annotations: { destructiveHint: true },
        },
        (input) =>
            run(() => {
                const deleted = useDrizzle()
                    .delete(tables.bodyweight)
                    .where(
                        and(
                            eq(tables.bodyweight.date, input.date),
                            eq(tables.bodyweight.userId, userId),
                        ),
                    )
                    .returning()
                    .get()
                if (!deleted) badRequest(`No weigh-in on ${input.date}`)
                return `Deleted weigh-in of ${deleted.date} (${deleted.weight}kg)`
            }),
    )
}
