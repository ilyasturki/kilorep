// Unit tests for the drag-to-reorder array move. Run with: bun run test:unit
import { expect, test } from 'bun:test'

import { moveItemTo } from '../app/utils/moveItemTo'

test('moves an item down to a later index', () => {
    expect(moveItemTo(['a', 'b', 'c', 'd'], 1, 3)).toEqual(['a', 'c', 'd', 'b'])
})

test('moves an item up to an earlier index', () => {
    expect(moveItemTo(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
})

test('moves to the first and last positions', () => {
    expect(moveItemTo(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
    expect(moveItemTo(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
})

test('a no-op move returns an equal copy, not the same reference', () => {
    const list = ['a', 'b', 'c']
    const out = moveItemTo(list, 1, 1)
    expect(out).toEqual(list)
    expect(out).not.toBe(list)
})

test('out-of-range indices leave the order unchanged', () => {
    expect(moveItemTo(['a', 'b', 'c'], -1, 2)).toEqual(['a', 'b', 'c'])
    expect(moveItemTo(['a', 'b', 'c'], 1, 9)).toEqual(['a', 'b', 'c'])
})

test('does not mutate the input array', () => {
    const list = ['a', 'b', 'c', 'd']
    moveItemTo(list, 0, 3)
    expect(list).toEqual(['a', 'b', 'c', 'd'])
})
