import { Fragment } from 'react'

/**
 * Renders `text` with the characters at the given `positions` wrapped in
 * `<mark>`, used to show which characters a fuzzy search actually matched.
 * `positions` are indices into `text` (not ranges); adjacent hits are collapsed
 * into a single `<mark>` so a matched run reads as one word fragment.
 */
export interface HighlightProps {
    text: string
    positions?: readonly number[]
}

export function Highlight({ text, positions = [] }: HighlightProps) {
    const hits = new Set(positions)
    const segments: { text: string; hit: boolean }[] = []
    let i = 0
    while (i < text.length) {
        const hit = hits.has(i)
        let j = i + 1
        while (j < text.length && hits.has(j) === hit) j++
        segments.push({ text: text.slice(i, j), hit })
        i = j
    }

    return (
        <span>
            {segments.map((seg, idx) =>
                seg.hit ?
                    // Distinct from the [data-highlighted] keyboard cursor
                    // state on combobox rows.
                    <mark
                        key={idx}
                        className='rounded-[2px] bg-accent-tint text-accent-ink'
                    >
                        {seg.text}
                    </mark>
                :   <Fragment key={idx}>{seg.text}</Fragment>,
            )}
        </span>
    )
}
