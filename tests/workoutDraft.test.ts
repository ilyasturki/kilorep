// Unit tests for the editor draft models. Run with: bun run test:unit
//
// These rules used to live inside the 700–1200 line editor pages, untestable
// without mounting. They diverge on purpose between the workout log and the
// session plan (prune-on-remove vs not), so each is pinned here against its
// own module.
import { expect, test } from 'bun:test'

import type {
    WorkoutEntryDraft,
    WorkoutExerciseDraft,
} from '../app/utils/workoutDraft'
import {
    emptySessionDraft,
    newSessionEntry,
    sessionDraftFromSession,
} from '../app/utils/sessionDraft'
import {
    addWorkoutSet,
    newWorkoutExercise,
    removeWorkoutExercise,
    ungroupWorkoutEntry,
    workoutDraftFromEntries,
    workoutDraftToBody,
} from '../app/utils/workoutDraft'

// ── workout draft ──────────────────────────────────────────────────────────

test('add set starts blank, never copying the previous set', () => {
    const ex: WorkoutExerciseDraft = { exerciseId: 1, name: 'Bench', sets: [] }
    addWorkoutSet(ex)
    expect(ex.sets).toEqual([{ reps: undefined, weight: undefined }])

    ex.sets[0] = { reps: 8, weight: 60 }
    addWorkoutSet(ex)
    expect(ex.sets[1]).toEqual({ reps: undefined, weight: undefined })
})

test('removing the last exercise of an entry drops the entry; otherwise keeps it', () => {
    const entries: WorkoutEntryDraft[] = [
        {
            id: 1,
            exercises: [
                { exerciseId: 1, name: 'A', sets: [] },
                { exerciseId: 2, name: 'B', sets: [] },
            ],
        },
        { id: 2, exercises: [{ exerciseId: 3, name: 'C', sets: [] }] },
    ]
    removeWorkoutExercise(entries, 1, 0) // empties entry 2 → pruned
    expect(entries).toHaveLength(1)
    removeWorkoutExercise(entries, 0, 0) // entry 1 still has B
    expect(entries[0].exercises.map((e) => e.exerciseId)).toEqual([2])
})

test('ungrouping a superset splits it into one entry per exercise, reusing the objects', () => {
    const a: WorkoutExerciseDraft = {
        exerciseId: 1,
        name: 'A',
        sets: [{ reps: 5, weight: 1 }],
    }
    const b: WorkoutExerciseDraft = { exerciseId: 2, name: 'B', sets: [] }
    const entries: WorkoutEntryDraft[] = [{ id: 9, exercises: [a, b] }]
    ungroupWorkoutEntry(entries, 0)
    expect(entries).toHaveLength(2)
    expect(entries[0].exercises[0]).toBe(a) // same object → logged sets survive
    expect(entries[1].exercises[0]).toBe(b)
})

test('serialization rides undefined weight as null and preserves reps', () => {
    const entries: WorkoutEntryDraft[] = [
        {
            id: 1,
            exercises: [
                {
                    exerciseId: 7,
                    name: 'OHP',
                    sets: [{ reps: 8, weight: undefined }],
                },
            ],
        },
    ]
    const body = workoutDraftToBody(entries, {
        completed: true,
        startedAt: '2026-06-23',
    })
    expect(body).toEqual({
        completed: true,
        startedAt: '2026-06-23',
        entries: [
            {
                exercises: [
                    {
                        exerciseId: 7,
                        sets: [{ reps: 8, weight: null }],
                    },
                ],
            },
        ],
    })
})

test('hydration turns null reps/weight from the API into undefined for the inputs', () => {
    const draft = workoutDraftFromEntries([
        {
            exercises: [
                {
                    exerciseId: 3,
                    exercise: { name: 'Row' },
                    sets: [{ reps: null, weight: null }],
                },
            ],
        },
    ])
    expect(draft[0].exercises[0].name).toBe('Row')
    expect(draft[0].exercises[0].sets[0]).toEqual({
        reps: undefined,
        weight: undefined,
    })
})

test('newWorkoutExercise seeds one blank set', () => {
    expect(newWorkoutExercise({ id: 4, name: 'Curl' })).toEqual({
        exerciseId: 4,
        name: 'Curl',
        sets: [{ reps: undefined, weight: undefined }],
    })
})

// ── session draft ──────────────────────────────────────────────────────────

test('an empty session draft starts with one entry holding one blank set', () => {
    const draft = emptySessionDraft()
    expect(draft.name).toBe('')
    expect(draft.entries).toHaveLength(1)
    expect(draft.entries[0].exercises).toEqual([
        { exerciseId: undefined, sets: [{ reps: undefined }] },
    ])
})

test('a superset entry seeds the requested number of exercises', () => {
    expect(newSessionEntry(2).exercises).toHaveLength(2)
})

test('session hydration turns null rep targets into undefined', () => {
    const draft = sessionDraftFromSession({
        name: 'Push',
        entries: [
            {
                exercises: [
                    { exerciseId: 1, sets: [{ reps: 8 }, { reps: null }] },
                ],
            },
        ],
    })
    expect(draft.name).toBe('Push')
    expect(draft.entries[0].exercises[0].sets).toEqual([
        { reps: 8 },
        { reps: undefined },
    ])
})
