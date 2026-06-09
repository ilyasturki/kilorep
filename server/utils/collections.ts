// Groups items by a derived key, preserving insertion order within each bucket.
// Shared by the session/workout read handlers that stitch flat rows into trees.
export function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
    const groups = new Map<K, T[]>()
    for (const item of items) {
        const list = groups.get(key(item))
        if (list) list.push(item)
        else groups.set(key(item), [item])
    }
    return groups
}
