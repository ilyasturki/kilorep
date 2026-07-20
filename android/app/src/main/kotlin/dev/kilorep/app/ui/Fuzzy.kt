package dev.kilorep.app.ui

import java.text.Normalizer

/**
 * Hand port of the web's subsequence ("fuzzy finder") matcher —
 * app/utils/fuzzy.ts — shared by the exercise picker and the catalog screen.
 * A query matches a field when every whitespace-delimited token appears in
 * order (not necessarily contiguous) within that field; tokens may match in
 * any order. Results carry a score for ranking and the matched character
 * positions for highlighting. Scoring changes on the web must be mirrored
 * here by hand.
 */
data class FuzzyMatch(
    val score: Int,
    /** Matched positions in the label; empty when the hit came from a keyword. */
    val labelPositions: List<Int>,
    /**
     * The keyword (e.g. exercise alias) that satisfied the query, if the label
     * itself didn't — surfaced so the result doesn't look unrelated.
     */
    val matchedKeyword: String? = null,
    val keywordPositions: List<Int> = emptyList(),
)

/**
 * Fold one UTF-16 unit to a single lowercase, diacritic-free unit. Done
 * per-character (not over the whole string) so the result stays the same
 * length as the input — match positions must index back into the raw text
 * to highlight it.
 */
private fun foldChar(ch: Char): Char {
    // Names are overwhelmingly ASCII; skip the Normalizer machinery for them.
    if (ch.code < 128) return ch.lowercaseChar()
    val folded = Normalizer.normalize(ch.toString(), Normalizer.Form.NFD)
        .replace(DIACRITICS, "")
        .lowercase()
    return folded.firstOrNull() ?: ch
}

private val DIACRITICS = Regex("\\p{Mn}")

private fun fold(s: String): String =
    buildString(s.length) { s.forEach { append(foldChar(it)) } }

// Item labels and keywords are static while the query changes on every
// keystroke, so memoize the fold: each distinct string is normalized once and
// reused across keystrokes (the cache stays bounded by the catalog's names).
// Main-thread only, like composition.
private val normCache = HashMap<String, String>()

private fun normalize(s: String): String = normCache.getOrPut(s) { fold(s) }

// A new "word" starts at the string start and after any of these separators,
// so matching there (e.g. the B and P of "Bench Press" for "bp") scores
// higher.
private fun isWordBoundary(ch: Char) = ch.isWhitespace() || ch in "-/(),."

private fun charScore(text: String, i: Int): Int = when {
    i == 0 -> 10
    isWordBoundary(text[i - 1]) -> 8
    else -> 1
}

private const val CONSECUTIVE_BONUS = 5

private data class FieldMatch(val score: Int, val positions: List<Int>)

/**
 * Best subsequence match of one token within already-normalized text. Tries
 * each occurrence of the first char as an anchor so "press" prefers the P of
 * "Press" over an earlier scattered P, then greedily matches the rest.
 */
private fun matchToken(text: String, token: String): FieldMatch? {
    if (token.isEmpty()) return FieldMatch(0, emptyList())
    var best: FieldMatch? = null
    for (start in text.indices) {
        if (text[start] != token[0]) continue
        val positions = mutableListOf(start)
        var score = charScore(text, start)
        var ti = 1
        var prev = start
        var i = start + 1
        while (i < text.length && ti < token.length) {
            if (text[i] == token[ti]) {
                score += charScore(text, i) + if (i == prev + 1) CONSECUTIVE_BONUS else 0
                positions.add(i)
                prev = i
                ti++
            }
            i++
        }
        if (ti < token.length) continue
        if (best == null || score > best.score) best = FieldMatch(score, positions)
    }
    return best
}

/** Every token must match the field; positions are unioned across tokens. */
private fun matchField(raw: String, tokens: List<String>): FieldMatch? {
    val text = normalize(raw)
    var score = 0
    val positions = sortedSetOf<Int>()
    for (token in tokens) {
        val m = matchToken(text, token) ?: return null
        score += m.score
        positions.addAll(m.positions)
    }
    return FieldMatch(score, positions.toList())
}

// Name hits should beat keyword hits of equal quality, so the label gets a
// small edge. A clearly stronger keyword match can still win.
private const val LABEL_BOOST = 3

/**
 * Split a query into normalized, whitespace-delimited tokens. Queries are
 * one-shot strings, so they fold uncached — only labels earn a cache slot.
 */
fun fuzzyTokens(query: String): List<String> =
    fold(query).trim().split(WHITESPACE).filter { it.isNotEmpty() }

private val WHITESPACE = Regex("\\s+")

/**
 * Match a query (as pre-split tokens) against a label and its extra keywords.
 * Returns the best field's match, or null if no field satisfies every token.
 * No tokens (empty query) matches everything with a zero score, so callers
 * keep their original order.
 */
fun fuzzyMatch(
    label: String,
    keywords: List<String>,
    tokens: List<String>,
): FuzzyMatch? {
    if (tokens.isEmpty()) return FuzzyMatch(0, emptyList())

    val labelHit = matchField(label, tokens)
    var best: FuzzyMatch? = labelHit?.let {
        FuzzyMatch(score = it.score + LABEL_BOOST, labelPositions = it.positions)
    }

    for (keyword in keywords) {
        val hit = matchField(keyword, tokens) ?: continue
        val current = best
        if (current != null && hit.score <= current.score) continue
        best = FuzzyMatch(
            score = hit.score,
            labelPositions = emptyList(),
            matchedKeyword = keyword,
            keywordPositions = hit.positions,
        )
    }
    return best
}
