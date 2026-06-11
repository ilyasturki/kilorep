import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'

import type { SessionWithEntries } from '~~/server/database/schema'
import { notFound } from '~~/server/utils/http'
import {
    createSessionTree,
    loadSessionTrees,
    parseSessionInput,
    replaceSessionTree,
} from '~~/server/utils/sessions'
import { resolveExercises, resolveSessionTemplate, run } from './helpers'

const entriesSchema = z
    .array(
        z
            .array(
                z.object({
                    exercise: z
                        .string()
                        .describe('Exercise name (fuzzy-matched)'),
                    reps: z
                        .array(z.number().int().positive())
                        .min(1)
                        .describe('Prescribed reps per set, e.g. [8, 8, 8]'),
                }),
            )
            .min(1),
    )
    .min(1)
    .describe(
        'Entries in order; an inner array with several exercises is a superset',
    )

type EntriesInput = z.infer<typeof entriesSchema>

/** Translates the MCP shape (exercise names + reps arrays) into the parsed
 * REST shape, resolving every name against a single catalog read. */
function toParsedSession(userId: number, name: string, entries: EntriesInput) {
    const resolved = resolveExercises(
        userId,
        entries.flatMap((entry) => entry.map((ex) => ex.exercise)),
    )
    let cursor = 0
    return parseSessionInput({
        name,
        entries: entries.map((entry) => ({
            exercises: entry.map((ex) => ({
                exerciseId: resolved[cursor++]!.id,
                sets: ex.reps.map((reps) => ({ reps })),
            })),
        })),
    })
}

function formatSession(session: SessionWithEntries): string {
    const lines = [session.name]
    session.entries.forEach((entry, index) => {
        const superset = entry.exercises.length > 1
        if (superset) lines.push(`${index + 1}. superset:`)
        for (const ex of entry.exercises) {
            const reps = ex.sets.map((set) => set.reps).join(', ')
            lines.push(
                `${superset ? '   - ' : `${index + 1}. `}${ex.exercise.name}: ${reps || 'no sets'}`,
            )
        }
    })
    return lines.join('\n')
}

function loadSessionTree(userId: number, id: number): SessionWithEntries {
    const tree = loadSessionTrees(userId, [id])[0]
    if (!tree) notFound('Session not found')
    return tree
}

export function registerSessionTools(server: McpServer, userId: number) {
    server.registerTool(
        'list_session_templates',
        {
            title: 'List session templates',
            description:
                'The reusable session templates (e.g. "Push Day") workouts can be started from, with the '
                + 'prescribed reps of every set. Supersets are grouped under one entry.',
            annotations: { readOnlyHint: true },
        },
        () =>
            run(() => {
                const sessions = loadSessionTrees(userId)
                if (sessions.length === 0) return 'No session templates yet.'
                return sessions.map(formatSession).join('\n\n')
            }),
    )

    server.registerTool(
        'create_session_template',
        {
            title: 'Create a session template',
            description:
                'Create a reusable session template prescribing exercises and their reps per set. '
                + 'Group several exercises in one entry to make a superset.',
            inputSchema: {
                name: z.string().describe('Template name, e.g. "Push Day"'),
                entries: entriesSchema,
            },
            annotations: { destructiveHint: false },
        },
        (input) =>
            run(() => {
                const parsed = toParsedSession(
                    userId,
                    input.name,
                    input.entries,
                )
                const session = createSessionTree(userId, parsed)
                return `Created template:\n${formatSession(loadSessionTree(userId, session.id))}`
            }),
    )

    server.registerTool(
        'update_session_template',
        {
            title: 'Update a session template',
            description:
                "Replace a session template's whole exercise list, optionally renaming it. Call "
                + 'list_session_templates first and send back every exercise to keep — anything omitted is '
                + 'removed. Workouts already logged from the template are not affected.',
            inputSchema: {
                session: z
                    .string()
                    .describe('Session template name (fuzzy-matched)'),
                name: z
                    .string()
                    .optional()
                    .describe('New name; defaults to the current one'),
                entries: entriesSchema,
            },
            annotations: { idempotentHint: true },
        },
        (input) =>
            run(() => {
                const template = resolveSessionTemplate(userId, input.session)
                const parsed = toParsedSession(
                    userId,
                    // An empty name means "no rename", like everywhere else —
                    // ?? alone would forward '' and fail the whole update.
                    input.name?.trim() || template.name,
                    input.entries,
                )
                replaceSessionTree(userId, template.id, parsed)
                return `Updated template:\n${formatSession(loadSessionTree(userId, template.id))}`
            }),
    )
}
