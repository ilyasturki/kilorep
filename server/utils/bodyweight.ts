import type { Bodyweight } from '~~/server/database/schema'

export type BodyweightInput = {
    date: string
    weight: number
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MIN_WEIGHT = 20
const MAX_WEIGHT = 400

// The page already blocks future dates against the user's own clock; this is a
// generous server-side backstop. A full day of slack absorbs the gap between the
// server's timezone and a client several hours ahead, so a legitimate "today"
// weigh-in is never rejected as the future.
function latestAcceptableDate(): string {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
}

// Validates a raw weigh-in payload, throwing a 400 on any malformed field.
// Shared by the create and update handlers so both enforce the same shape.
export function parseBodyweightInput(
    body: Record<string, unknown>,
): BodyweightInput {
    const { date, weight } = body
    if (
        typeof date !== 'string'
        || !DATE_RE.test(date)
        || Number.isNaN(Date.parse(date))
    ) {
        badRequest('A valid date is required')
    }
    if (date > latestAcceptableDate()) {
        badRequest("Date can't be in the future")
    }

    if (typeof weight !== 'number' || !Number.isFinite(weight)) {
        badRequest('Weight is required')
    }
    if (weight < MIN_WEIGHT || weight > MAX_WEIGHT) {
        badRequest(`Weight must be between ${MIN_WEIGHT} and ${MAX_WEIGHT} kg`)
    }

    // Pin to two decimals so averaged weigh-ins keep their precision while float
    // garbage like 82.40000001 never lands in the store.
    return { date, weight: Math.round(weight * 100) / 100 }
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
