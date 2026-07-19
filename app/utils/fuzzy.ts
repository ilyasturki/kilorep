// Generic subsequence ("fuzzy finder") matcher shared by the exercise combobox
// and the catalog page. A query matches a field when every whitespace-delimited
// token appears in order (not necessarily contiguous) within that field; tokens
// may match in any order. Results carry a score for ranking and the matched
// character positions for highlighting.

export type FuzzyMatch = {
    score: number
    // Matched positions in the label; empty when the hit came from a keyword.
    labelPositions: number[]
    // The keyword (e.g. exercise alias) that satisfied the query, if the label
    // itself didn't — surfaced so the result doesn't look unrelated.
    matchedKeyword?: string
    keywordPositions?: number[]
}

// Fold one UTF-16 unit to a single lowercase, diacritic-free unit. Done
// per-character (not over the whole string) so the result stays the same length
// as the input — match positions must index back into the raw text to highlight
// it. This mirrors the old reka-ui useFilter({ sensitivity: 'base' }) folding.
function foldChar(ch: string): string {
    const folded = (
        ch.normalize('NFD').replace(/\p{Diacritic}/gu, '') || ch
    ).toLowerCase()
    return folded[0] ?? ch
}

// Item labels and keywords are static while the query changes on every
// keystroke, so memoize the fold: each distinct string is normalized once and
// reused across keystrokes (the cache stays small — a catalog of names plus the
// short queries typed this session).
const normCache = new Map<string, string>()

function normalize(s: string): string {
    let out = normCache.get(s)
    if (out === undefined) {
        out = ''
        for (let i = 0; i < s.length; i++) out += foldChar(s[i]!)
        normCache.set(s, out)
    }
    return out
}

// A new "word" starts at the string start and after any of these separators, so
// matching there (e.g. the B and P of "Bench Press" for "bp") scores higher.
const WORD_BOUNDARY = /[\s\-/(),.]/

function charScore(text: string, i: number): number {
    if (i === 0) return 10
    if (WORD_BOUNDARY.test(text[i - 1]!)) return 8
    return 1
}

const CONSECUTIVE_BONUS = 5

// Best subsequence match of one token within already-normalized text. Tries each
// occurrence of the first char as an anchor so "press" prefers the P of "Press"
// over an earlier scattered P, then greedily matches the rest.
function matchToken(
    text: string,
    token: string,
): { score: number; positions: number[] } | null {
    if (!token) return { score: 0, positions: [] }
    let best: { score: number; positions: number[] } | null = null
    for (let start = 0; start < text.length; start++) {
        if (text[start] !== token[0]) continue
        const positions = [start]
        let score = charScore(text, start)
        let ti = 1
        let prev = start
        for (let i = start + 1; i < text.length && ti < token.length; i++) {
            if (text[i] !== token[ti]) continue
            score +=
                charScore(text, i) + (i === prev + 1 ? CONSECUTIVE_BONUS : 0)
            positions.push(i)
            prev = i
            ti++
        }
        if (ti < token.length) continue
        if (!best || score > best.score) best = { score, positions }
    }
    return best
}

// Every token must match the field; positions are unioned across tokens.
function matchField(
    raw: string,
    tokens: readonly string[],
): { score: number; positions: number[] } | null {
    const text = normalize(raw)
    let score = 0
    const positions = new Set<number>()
    for (const token of tokens) {
        const m = matchToken(text, token)
        if (!m) return null
        score += m.score
        for (const p of m.positions) positions.add(p)
    }
    return { score, positions: [...positions].toSorted((a, b) => a - b) }
}

// Name hits should beat keyword hits of equal quality, so the label gets a small
// edge. A clearly stronger keyword match can still win.
const LABEL_BOOST = 3

// Split a query into normalized, whitespace-delimited tokens.
export function fuzzyTokens(query: string): string[] {
    return normalize(query).trim().split(/\s+/).filter(Boolean)
}

// Match a query (as pre-split tokens) against a label and its extra keywords.
// Returns the best field's match, or null if no field satisfies every token.
// No tokens (empty query) matches everything with a zero score, so callers keep
// their original order.
export function fuzzyMatch(
    label: string,
    keywords: readonly string[],
    tokens: readonly string[],
): FuzzyMatch | null {
    if (tokens.length === 0) return { score: 0, labelPositions: [] }

    const labelHit = matchField(label, tokens)
    let best: FuzzyMatch | null =
        labelHit ?
            {
                score: labelHit.score + LABEL_BOOST,
                labelPositions: labelHit.positions,
            }
        :   null

    for (const keyword of keywords) {
        const hit = matchField(keyword, tokens)
        if (!hit || (best && hit.score <= best.score)) continue
        best = {
            score: hit.score,
            labelPositions: [],
            matchedKeyword: keyword,
            keywordPositions: hit.positions,
        }
    }
    return best
}
