import * as z from 'zod/mini'

/** The plausible range for a logged bodyweight, in kilograms. */
export const MIN_WEIGHT = 20
export const MAX_WEIGHT = 400

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * A full day of slack past today absorbs the gap between the server's clock and
 * a client several hours ahead, so a legitimate "today" weigh-in is never
 * rejected as the future. The form is stricter (it blocks anything after the
 * device's today); this is the backstop behind it.
 */
export function latestAcceptableDate(): string {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() + 1)
    return d.toISOString().slice(0, 10)
}

export const bodyweightInputSchema = z.object({
    date: z.pipe(
        z.transform((value: unknown) =>
            typeof value === 'string' ? value : '',
        ),
        z.string().check(
            z.refine(
                (date) => DATE_RE.test(date) && !Number.isNaN(Date.parse(date)),
                'A valid date is required',
            ),
            z.refine(
                (date) => date <= latestAcceptableDate(),
                "Date can't be in the future",
            ),
        ),
    ),
    weight: z.pipe(
        z.number({ error: 'Weight is required' }).check(
            z.refine(Number.isFinite, 'Weight is required'),
            z.refine(
                (weight) => weight >= MIN_WEIGHT && weight <= MAX_WEIGHT,
                `Weight must be between ${MIN_WEIGHT} and ${MAX_WEIGHT} kg`,
            ),
        ),
        // Pin to two decimals so averaged weigh-ins keep their precision while
        // float garbage like 82.40000001 never lands in the store.
        z.transform((weight: number) => Math.round(weight * 100) / 100),
    ),
})

export type BodyweightInput = z.output<typeof bodyweightInputSchema>
