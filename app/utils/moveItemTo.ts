// Returns a new array with the item at `from` relocated to `to`, leaving the
// input untouched. Drag-to-reorder needs an arbitrary from→to move; the up/down
// arrows use moveItem (in-place ±1) instead. A no-op or out-of-range request
// yields an unchanged copy, so callers can always treat the result as the next
// array without a separate "did it change" check.
//
// Named moveItemTo rather than moveTo so it can't be shadowed by the global
// window.moveTo (which takes two args and returns void).
export function moveItemTo<T>(list: T[], from: number, to: number): T[] {
    const next = list.slice()
    if (
        from === to
        || from < 0
        || from >= list.length
        || to < 0
        || to >= list.length
    ) {
        return next
    }
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item as T)
    return next
}
