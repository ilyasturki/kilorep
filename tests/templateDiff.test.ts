// Unit tests for the workout-vs-template diff. Run with: bun run test:unit
//
// diffWorkoutFromTemplate feeds the "what differs" modal; structuresDiffer is
// what gates the strip. The contract that keeps them consistent: a change is
// structural iff its kind isn't 'reps', and that set is non-empty iff the trees
// differ structurally — so a rep-only edit lists a change without lighting the
// strip.
import { expect, test } from 'bun:test'

import {
    diffWorkoutFromTemplate,
    structuresDiffer,
} from '../server/utils/template-sync'

const ex = (exerciseId: number, sets: (number | null)[]) => ({
    exerciseId,
    sets: sets.map((reps) => ({ reps })),
})
const entry = (...exercises: ReturnType<typeof ex>[]) => ({ exercises })

// The strip is structural-only; the modal shows everything. Tie them together.
const structuralChanges = (
    w: ReturnType<typeof entry>[],
    t: ReturnType<typeof entry>[],
) => diffWorkoutFromTemplate(w, t).some((c) => c.kind !== 'reps')

test('identical trees: no changes, not diverged', () => {
    const tree = [entry(ex(1, [10, 10]), ex(2, [8]))]
    expect(diffWorkoutFromTemplate(tree, tree)).toEqual([])
    expect(structuresDiffer(tree, tree)).toBe(false)
})

test('an added exercise surfaces once, by id', () => {
    const template = [entry(ex(1, [10]))]
    const workout = [entry(ex(1, [10])), entry(ex(2, [10]))]
    expect(diffWorkoutFromTemplate(workout, template)).toEqual([
        { kind: 'added', exerciseId: 2 },
    ])
})

test('a removed exercise surfaces once, by id', () => {
    const template = [entry(ex(1, [10])), entry(ex(2, [10]))]
    const workout = [entry(ex(1, [10]))]
    expect(diffWorkoutFromTemplate(workout, template)).toEqual([
        { kind: 'removed', exerciseId: 2 },
    ])
})

test('a set-count change reports the new count and the old', () => {
    const template = [entry(ex(1, [10, 10, 10]))]
    const workout = [entry(ex(1, [10, 10, 10, 10]))]
    expect(diffWorkoutFromTemplate(workout, template)).toEqual([
        { kind: 'sets', exerciseId: 1, count: 4, was: 3 },
    ])
})

test('a rep-target change lists a change but is NOT structural drift', () => {
    const template = [entry(ex(1, [10, 10]))]
    const workout = [entry(ex(1, [10, 8]))]
    expect(diffWorkoutFromTemplate(workout, template)).toEqual([
        { kind: 'reps', exerciseId: 1, setIndex: 1, reps: 8, was: 10 },
    ])
    // The reps row exists, but the strip stays hidden.
    expect(structuralChanges(workout, template)).toBe(false)
    expect(structuresDiffer(workout, template)).toBe(false)
})

test('open targets (null) compare cleanly and read as a change vs a number', () => {
    const template = [entry(ex(1, [null]))]
    const workout = [entry(ex(1, [8]))]
    expect(diffWorkoutFromTemplate(workout, template)).toEqual([
        { kind: 'reps', exerciseId: 1, setIndex: 0, reps: 8, was: null },
    ])
})

test('a pure reorder collapses to one note instead of phantom add/remove', () => {
    const template = [entry(ex(1, [10])), entry(ex(2, [10]))]
    const workout = [entry(ex(2, [10])), entry(ex(1, [10]))]
    expect(diffWorkoutFromTemplate(workout, template)).toEqual([
        { kind: 'reordered' },
    ])
    expect(structuresDiffer(workout, template)).toBe(true)
})

test('a superset regrouping (same exercises) reads as reordered', () => {
    const template = [entry(ex(1, [10]), ex(2, [10]))]
    const workout = [entry(ex(1, [10])), entry(ex(2, [10]))]
    expect(diffWorkoutFromTemplate(workout, template)).toEqual([
        { kind: 'reordered' },
    ])
    expect(structuresDiffer(workout, template)).toBe(true)
})

test('structural and rep changes coexist; the strip gate ignores reps', () => {
    const template = [entry(ex(1, [10, 10]))]
    const workout = [entry(ex(1, [10, 8])), entry(ex(2, [12]))]
    const changes = diffWorkoutFromTemplate(workout, template)
    expect(changes).toContainEqual({ kind: 'added', exerciseId: 2 })
    expect(changes).toContainEqual({
        kind: 'reps',
        exerciseId: 1,
        setIndex: 1,
        reps: 8,
        was: 10,
    })
    expect(structuralChanges(workout, template)).toBe(true)
})
