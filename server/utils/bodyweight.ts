import type { Bodyweight } from '~~/server/database/schema'
import type { BodyweightInput } from '~~/shared/validation/bodyweight'
import { bodyweightInputSchema } from '~~/shared/validation/bodyweight'
import { firstMessage } from '~~/shared/validation/primitives'

export type { BodyweightInput }

// Validates a raw weigh-in payload, throwing a 400 on any malformed field.
// Shared by the create and update handlers so both enforce the same shape —
// and by the weigh-in form, which runs the same schema before enabling save.
export function parseBodyweightInput(
    body: Record<string, unknown>,
): BodyweightInput {
    const result = bodyweightInputSchema.safeParse(body)
    if (!result.success) {
        badRequest(firstMessage(result.error, 'A valid weigh-in is required'))
    }
    return result.data
}

// One weigh-in per user and day: logging a date that already exists overwrites
// its weight rather than erroring or stacking a second point on the chart.
// Shared by `POST /api/bodyweight` and the MCP weigh-in tool.
export function upsertBodyweight(
    userId: number,
    values: BodyweightInput,
): Bodyweight {
    return useDrizzle()
        .insert(tables.bodyweight)
        .values({ ...values, userId })
        .onConflictDoUpdate({
            target: [tables.bodyweight.userId, tables.bodyweight.date],
            set: { weight: values.weight },
        })
        .returning()
        .get()
}
