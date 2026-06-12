// Moves list[index] one step up or down in place. Returns false when the move
// would fall off either end, so callers can skip persisting a no-op.
export function moveItem<T>(list: T[], index: number, dir: -1 | 1): boolean {
    const target = index + dir
    if (target < 0 || target >= list.length) return false
    const [item] = list.splice(index, 1)
    if (item !== undefined) list.splice(target, 0, item)
    return true
}
