// Unit tests for the shared volume helpers. Run with: bun run test:unit
//
// The drafts on the workout page bind sets to reka-ui NumberFields, which set
// the model to `undefined` when the input is cleared — so the helpers must
// tolerate missing reps/weight without poisoning the sum with NaN.
import { expect, test } from 'bun:test'

import { setVolume, workoutStats } from '../shared/utils/stats'

test('volume is load × reps summed over sets', () => {
    expect(setVolume([{ reps: 10, weight: 20 }])).toBe(200)
    expect(
        setVolume([
            { reps: 10, weight: 20 },
            { reps: 5, weight: 40 },
        ]),
    ).toBe(400)
})

test('un-entered weight counts as 0', () => {
    expect(
        setVolume([
            { reps: 8, weight: undefined },
            { reps: 8, weight: null },
            { reps: 8, weight: 50 },
        ]),
    ).toBe(400)
})

test('un-entered reps count as 0 (cleared NumberField, null from the API)', () => {
    expect(
        setVolume([
            { reps: undefined, weight: 50 },
            { reps: null, weight: 50 },
            { reps: 8, weight: 50 },
        ]),
    ).toBe(400)
})

test('workoutStats totals stay finite with cleared inputs', () => {
    const stats = workoutStats([
        {
            exercises: [
                {
                    sets: [
                        { reps: undefined, weight: 50 },
                        { reps: 8, weight: undefined },
                        { reps: 8, weight: 50 },
                    ],
                },
            ],
        },
    ])
    expect(stats).toEqual({ exercises: 1, sets: 3, volume: 400 })
})

test('per-hand and unilateral loads count double in volume, total stays raw', () => {
    expect(setVolume([{ reps: 10, weight: 22.5 }], 'per-hand')).toBe(450)
    expect(setVolume([{ reps: 10, weight: 40 }], 'unilateral')).toBe(800)
    expect(setVolume([{ reps: 10, weight: 40 }], 'total')).toBe(400)
    expect(setVolume([{ reps: 10, weight: 40 }])).toBe(400)
})

test('workoutStats reads the mode flat off a draft or nested under exercise', () => {
    const sets = [{ reps: 10, weight: 20 }]
    const stats = workoutStats([
        {
            exercises: [
                { sets, loadMode: 'per-hand' },
                { sets, exercise: { loadMode: 'unilateral' } },
                { sets },
            ],
        },
    ])
    expect(stats.volume).toBe(400 + 400 + 200)
})
