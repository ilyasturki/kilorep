import * as z from 'zod/mini'

/**
 * The field-level coercions the gym data model is built from. They live in
 * shared/ so the form, the API handler and the MCP tool all normalise a typed
 * value the same way — the fractional-reps drift (a form writing 6.5 while the
 * contract said integer) came from three places each deciding on their own.
 *
 * These never fail: a value that makes no sense becomes null, which every
 * caller already treats as "not entered yet". Validation that can reject lives
 * in the per-entity schemas beside this file.
 *
 * zod/mini rather than zod: these schemas ship to the browser, where the full
 * builder API costs ~30 kB gzipped against mini's ~5 kB for the same rules.
 */

/** A usable rep count is a positive finite number; anything else is null. */
const toRepCount = (value: unknown): number | null => {
    const reps = Number(value)
    return Number.isFinite(reps) && reps > 0 ? reps : null
}

/**
 * A LOGGED rep keeps its fraction: a half-rep (a failed grind on the last set)
 * is a real thing to record. A single fractional value is enough to fail strict
 * deserialization on a typed client and blank its whole history, so the
 * contract and clients carry the fraction end to end rather than the server
 * silently rounding it away.
 */
export const loggedRepsSchema = z.transform(toRepCount)

/**
 * A rep TARGET is a whole prescription ("do 8"), so a fractional input rounds
 * to the nearest rep — the typed clients model targets as integers.
 */
export const repsTargetSchema = z.transform((value: unknown) => {
    const reps = toRepCount(value)
    return reps == null ? null : Math.round(reps)
})

/** Logged load in kilograms. Absent, unparseable or negative reads as "open". */
export const loadSchema = z.transform((value: unknown) => {
    if (value == null) return null
    const weight = Number(value)
    return Number.isFinite(weight) && weight >= 0 ? weight : null
})

/**
 * The message a failed parse should show. The entity schemas declare their
 * fields in the order the hand-written parsers checked them, so the first issue
 * is the same complaint the API has always returned. Typed structurally so it
 * reads an error from either zod entry point.
 */
export function firstMessage(
    error: { issues: readonly { message: string }[] },
    fallback: string,
): string {
    return error.issues[0]?.message ?? fallback
}
