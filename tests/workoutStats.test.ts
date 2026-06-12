// Unit tests for the shared volume helpers. Run with: bun run test:unit
//
// The drafts on the workout page bind sets to reka-ui NumberFields, which set
// the model to `undefined` when the input is cleared — so the helpers must
// tolerate missing reps/weight without poisoning the sum with NaN.
import { expect, test } from 'bun:test'

import { setVolume, workoutStats } from '../app/utils/workoutStats'

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
