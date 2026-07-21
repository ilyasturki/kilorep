// Domain tests for the deepened workout write modules, against an in-memory
// database (see ./setup.ts). These paths — transaction ownership, tree stitch,
// open-target seeding — were previously reachable only through a full HTTP
// round-trip; now the module interface is the test surface. Run: bun run test:domain
import { beforeEach, expect, test } from 'vitest'

import { tables, useDrizzle } from '../../server/utils/drizzle'
import { createExercise } from '../../server/utils/exercises'
import {
    createSessionTree,
    parseSessionInput,
} from '../../server/utils/sessions'
import {
    copySessionToWorkout,
    createWorkout,
    loadWorkoutTrees,
    parseWorkoutInput,
    saveWorkout,
} from '../../server/utils/workouts'

let userId: number

function newUser(): number {
    return useDrizzle()
        .insert(tables.users)
        .values({ provider: 'local', providerAccountId: `u${Math.random()}` })
        .returning()
        .get().id
}

const benchInput = {
    name: 'Bench',
    equipment: 'barbell',
    type: 'compound',
    muscles: [{ muscle: 'chest', intensity: 'high' }],
}

// Each test runs against its own user; every query is userId-scoped, so prior
// tests' rows never leak in.
beforeEach(() => {
    userId = newUser()
})

test('createWorkout persists the tree and loadWorkoutTrees reads it back', () => {
    const ex = createExercise(userId, benchInput)
    const parsed = parseWorkoutInput({
        name: 'Push',
        completed: true,
        entries: [
            {
                exercises: [
                    {
                        exerciseId: ex.id,
                        sets: [
                            { reps: 8, weight: 60 },
                            { reps: 7, weight: 60 },
                        ],
                    },
                ],
            },
        ],
    })

    const workout = createWorkout(userId, parsed)
    const tree = loadWorkoutTrees(userId, [workout.id])[0]!

    expect(tree.name).toBe('Push')
    expect(tree.completed).toBe(true)
    expect(tree.entries).toHaveLength(1)
    const logged = tree.entries[0]!.exercises[0]!
    expect(logged.exerciseId).toBe(ex.id)
    expect(logged.sets.map((s) => [s.reps, s.weight])).toEqual([
        [8, 60],
        [7, 60],
    ])
})

test('createWorkout falls back to the default name when the payload has none', () => {
    const ex = createExercise(userId, benchInput)
    const parsed = parseWorkoutInput({
        completed: false,
        entries: [{ exercises: [{ exerciseId: ex.id, sets: [{ reps: 5 }] }] }],
    })
    const workout = createWorkout(userId, parsed, null, 'Leg Day')
    expect(workout.name).toBe('Leg Day')
    expect(workout.sessionId).toBeNull()
})

test('saveWorkout replaces the whole tree and updates row fields', () => {
    const bench = createExercise(userId, benchInput)
    const workout = createWorkout(
        userId,
        parseWorkoutInput({
            completed: false,
            entries: [
                { exercises: [{ exerciseId: bench.id, sets: [{ reps: 5 }] }] },
            ],
        }),
    )

    const row = createExercise(userId, {
        name: 'Row',
        equipment: 'cable',
        type: 'compound',
        muscles: [{ muscle: 'lats', intensity: 'high' }],
    })
    saveWorkout(
        userId,
        workout.id,
        parseWorkoutInput({
            completed: true,
            entries: [
                {
                    exercises: [
                        {
                            exerciseId: row.id,
                            sets: [{ reps: 10, weight: 40 }],
                        },
                    ],
                },
            ],
        }),
    )

    const tree = loadWorkoutTrees(userId, [workout.id])[0]!
    expect(tree.completed).toBe(true)
    expect(tree.entries).toHaveLength(1)
    expect(tree.entries[0]!.exercises[0]!.exerciseId).toBe(row.id)
    expect(tree.entries[0]!.exercises[0]!.sets).toHaveLength(1)
})

test('saveWorkout 404s on a workout another user owns, leaving it untouched', () => {
    const ex = createExercise(userId, benchInput)
    const workout = createWorkout(
        userId,
        parseWorkoutInput({
            completed: true,
            entries: [
                { exercises: [{ exerciseId: ex.id, sets: [{ reps: 5 }] }] },
            ],
        }),
    )

    const intruder = newUser()
    const intruderEx = createExercise(intruder, benchInput)
    expect(() =>
        saveWorkout(
            intruder,
            workout.id,
            parseWorkoutInput({
                completed: false,
                entries: [
                    {
                        exercises: [
                            { exerciseId: intruderEx.id, sets: [{ reps: 1 }] },
                        ],
                    },
                ],
            }),
        ),
    ).toThrow()

    // The owner's workout is unchanged.
    expect(loadWorkoutTrees(userId, [workout.id])[0]!.completed).toBe(true)
})

test('copySessionToWorkout leaves an open target blank, snapshotting the last logged reps as repHint', () => {
    const squat = createExercise(userId, {
        name: 'Squat',
        equipment: 'barbell',
        type: 'compound',
        muscles: [{ muscle: 'quads', intensity: 'high' }],
    })

    // A prior workout logged Squat at 5 reps.
    createWorkout(
        userId,
        parseWorkoutInput({
            completed: true,
            entries: [
                {
                    exercises: [
                        {
                            exerciseId: squat.id,
                            sets: [{ reps: 5, weight: 100 }],
                        },
                    ],
                },
            ],
        }),
    )

    // A template prescribing one open set, one fixed target, and one open set
    // beyond the history's length.
    const session = createSessionTree(
        userId,
        parseSessionInput({
            name: 'Leg Day',
            entries: [
                {
                    exercises: [
                        {
                            exerciseId: squat.id,
                            sets: [{ reps: null }, { reps: 8 }, { reps: null }],
                        },
                    ],
                },
            ],
        }),
    )

    const workout = copySessionToWorkout(userId, session.id)
    const tree = loadWorkoutTrees(userId, [workout.id])[0]!
    const sets = tree.entries[0]!.exercises[0]!.sets

    expect(workout.sessionId).toBe(session.id)
    expect(sets.map((s) => [s.reps, s.repHint])).toEqual([
        [null, 5], // open: blank reps, history rides as the hint
        [8, null], // prescribed: the target prefills, no hint
        [null, 5], // beyond the history, the last logged set covers the hint
    ])
    expect(sets.map((s) => s.weight)).toEqual([null, null, null])
})

test('copySessionToWorkout leaves an open target blank and hint-less without history', () => {
    const squat = createExercise(userId, {
        name: 'Squat',
        equipment: 'barbell',
        type: 'compound',
        muscles: [{ muscle: 'quads', intensity: 'high' }],
    })
    const session = createSessionTree(
        userId,
        parseSessionInput({
            name: 'Leg Day',
            entries: [
                {
                    exercises: [
                        { exerciseId: squat.id, sets: [{ reps: null }] },
                    ],
                },
            ],
        }),
    )

    const workout = copySessionToWorkout(userId, session.id)
    const set = loadWorkoutTrees(userId, [workout.id])[0]!.entries[0]!
        .exercises[0]!.sets[0]!
    expect(set.reps).toBeNull()
    expect(set.repHint).toBeNull()
})

test('saveWorkout keeps an echoed repHint across the whole-tree rewrite', () => {
    const ex = createExercise(userId, benchInput)
    const workout = createWorkout(
        userId,
        parseWorkoutInput({
            entries: [
                { exercises: [{ exerciseId: ex.id, sets: [{ reps: 5 }] }] },
            ],
        }),
    )

    saveWorkout(
        userId,
        workout.id,
        parseWorkoutInput({
            completed: false,
            entries: [
                {
                    exercises: [
                        {
                            exerciseId: ex.id,
                            sets: [{ reps: null, repHint: 6.5 }],
                        },
                    ],
                },
            ],
        }),
    )

    const set = loadWorkoutTrees(userId, [workout.id])[0]!.entries[0]!
        .exercises[0]!.sets[0]!
    expect(set.reps).toBeNull()
    expect(set.repHint).toBe(6.5) // fractional history survives the echo
})

test('parseWorkoutInput rejects a payload with no usable exercise', () => {
    expect(() => parseWorkoutInput({ entries: [] })).toThrow()
})

test('parseWorkoutInput preserves fractional reps (half-reps are loggable)', () => {
    const ex = createExercise(userId, benchInput)
    const workout = createWorkout(
        userId,
        parseWorkoutInput({
            entries: [
                {
                    exercises: [
                        {
                            exerciseId: ex.id,
                            sets: [{ reps: 6.5, weight: 50 }],
                        },
                    ],
                },
            ],
        }),
    )
    const set = loadWorkoutTrees(userId, [workout.id])[0]!.entries[0]!
        .exercises[0]!.sets[0]!
    expect(set.reps).toBe(6.5)
})
