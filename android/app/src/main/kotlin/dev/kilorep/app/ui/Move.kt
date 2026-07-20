package dev.kilorep.app.ui

/** The list with the element at [from] reinserted at [to]; a no-op on bad indexes. */
fun <T> List<T>.moved(from: Int, to: Int): List<T> =
    if (from !in indices || to !in indices || from == to) {
        this
    } else {
        toMutableList().apply { add(to, removeAt(from)) }
    }

/**
 * Drag reorders report item keys, not indexes — resolving them against the
 * list being moved (at apply time) is what makes a stale UI capture unable
 * to misplace an entry.
 */
inline fun <T> List<T>.movedByKey(fromKey: Any?, toKey: Any?, key: (T) -> Any?): List<T> =
    moved(indexOfFirst { key(it) == fromKey }, indexOfFirst { key(it) == toKey })
