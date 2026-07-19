import { describe, expect, test } from 'bun:test'

import { bodyweightInputSchema } from '../shared/validation/bodyweight'
import { exerciseInputSchema } from '../shared/validation/exercise'
import {
    loadSchema,
    loggedRepsSchema,
    repsTargetSchema,
} from '../shared/validation/primitives'

// These pin the normalisation the forms and the API have to agree on. The
// fractional-reps incident (a form writing 6.5 where the contract said integer)
// is the reason the rules live in one place at all.

describe('rep counts', () => {
    test('a logged rep keeps its fraction, a target rounds to a whole rep', () => {
        expect(loggedRepsSchema.parse(6.5)).toBe(6.5)
        expect(repsTargetSchema.parse(6.5)).toBe(7)
        expect(repsTargetSchema.parse(6.4)).toBe(6)
    })

    test('anything unusable reads as an open target', () => {
        for (const value of [undefined, null, '', 0, -3, 'abc', Number.NaN]) {
            expect(loggedRepsSchema.parse(value)).toBeNull()
            expect(repsTargetSchema.parse(value)).toBeNull()
        }
    })

    test('numeric strings coerce, so a raw input value still lands', () => {
        expect(loggedRepsSchema.parse('8')).toBe(8)
        expect(repsTargetSchema.parse('8')).toBe(8)
    })
})

describe('load', () => {
    test('zero is a real bodyweight load, negatives and junk are not', () => {
        expect(loadSchema.parse(0)).toBe(0)
        expect(loadSchema.parse(82.5)).toBe(82.5)
        expect(loadSchema.parse(-1)).toBeNull()
        expect(loadSchema.parse(null)).toBeNull()
        expect(loadSchema.parse(undefined)).toBeNull()
        expect(loadSchema.parse('heavy')).toBeNull()
    })
})

describe('exercise input', () => {
    const valid = {
        name: '  Bench Press  ',
        equipment: 'barbell',
        type: 'compound',
        muscles: [{ muscle: ' chest ', intensity: 'high' }],
    }

    test('trims the name and the muscle names', () => {
        const parsed = exerciseInputSchema.parse(valid)
        expect(parsed.name).toBe('Bench Press')
        expect(parsed.muscles).toEqual([{ muscle: 'chest', intensity: 'high' }])
    })

    test('an unnamed muscle row is an empty form slot, not an error', () => {
        const parsed = exerciseInputSchema.parse({
            ...valid,
            muscles: [
                { muscle: '', intensity: 'high' },
                { muscle: 'chest', intensity: 'low' },
                { muscle: '   ', intensity: 'high' },
            ],
        })
        expect(parsed.muscles).toEqual([{ muscle: 'chest', intensity: 'low' }])
    })

    test('a named muscle row with a bad intensity is still rejected', () => {
        const result = exerciseInputSchema.safeParse({
            ...valid,
            muscles: [{ muscle: 'chest', intensity: 'enormous' }],
        })
        expect(result.success).toBe(false)
        expect(result.error?.issues[0]?.message).toBe(
            'Invalid muscle intensity',
        )
    })

    test('reports the same first complaint the API has always returned', () => {
        const cases: [Record<string, unknown>, string][] = [
            [{ ...valid, name: '   ' }, 'Name is required'],
            [{ ...valid, equipment: 'telekinesis' }, 'Invalid equipment'],
            [{ ...valid, type: 'cardio' }, 'Invalid type'],
            [{ ...valid, muscles: [] }, 'At least one muscle is required'],
        ]
        for (const [body, message] of cases) {
            const result = exerciseInputSchema.safeParse(body)
            expect(result.error?.issues[0]?.message).toBe(message)
        }
    })
})

describe('bodyweight input', () => {
    test('pins the weight to two decimals', () => {
        expect(
            bodyweightInputSchema.parse({
                date: '2026-01-15',
                weight: 82.40000001,
            }).weight,
        ).toBe(82.4)
    })

    test('holds the plausible range', () => {
        const message = 'Weight must be between 20 and 400 kg'
        for (const weight of [19.9, 400.1]) {
            const result = bodyweightInputSchema.safeParse({
                date: '2026-01-15',
                weight,
            })
            expect(result.error?.issues[0]?.message).toBe(message)
        }
        for (const weight of [20, 400]) {
            expect(
                bodyweightInputSchema.safeParse({ date: '2026-01-15', weight })
                    .success,
            ).toBe(true)
        }
    })

    test('rejects a malformed date before anything else', () => {
        for (const date of ['15/01/2026', '2026-13-45', '', 20260115]) {
            const result = bodyweightInputSchema.safeParse({ date, weight: 80 })
            expect(result.error?.issues[0]?.message).toBe(
                'A valid date is required',
            )
        }
    })

    test('rejects a date beyond the timezone slack', () => {
        const wayAhead = new Date()
        wayAhead.setUTCDate(wayAhead.getUTCDate() + 3)
        const result = bodyweightInputSchema.safeParse({
            date: wayAhead.toISOString().slice(0, 10),
            weight: 80,
        })
        expect(result.error?.issues[0]?.message).toBe(
            "Date can't be in the future",
        )
    })

    test('accepts tomorrow, so a client ahead of the server still logs today', () => {
        const tomorrow = new Date()
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
        expect(
            bodyweightInputSchema.safeParse({
                date: tomorrow.toISOString().slice(0, 10),
                weight: 80,
            }).success,
        ).toBe(true)
    })
})
