import type { ReactNode } from 'react'
import { tv } from 'tailwind-variants'

// One entry of a session plan or workout readout. A superset trades the divider
// above it for a left rule, so the grouped exercises read as one unit.
const planBlock = tv({
    slots: {
        root: 'border-t border-t-line py-1.5 first:border-t-0',
        tag: 'inline-block pt-1.5 pb-0.5 font-mono text-[9.5px] font-semibold tracking-[0.14em] text-ink-3',
    },
    variants: {
        superset: {
            true: {
                root: 'my-2 border-t-0 border-l-2 border-l-line-2 pl-3.5',
            },
        },
    },
})

/**
 * One entry of a session plan or workout readout, wrapping the PlanExercise
 * lines that belong to it. Consecutive blocks separate themselves with a top
 * hairline (the first one goes without).
 *
 * `superset` marks the block as a grouped set: it drops the divider for a left
 * rule plus a SUPERSET tag, so the exercises inside read as one unit.
 */
export interface PlanBlockProps {
    superset?: boolean
    className?: string
    children?: ReactNode
}

export function PlanBlock({ superset, className, children }: PlanBlockProps) {
    const { root, tag } = planBlock({ superset })
    return (
        <div className={root({ className })}>
            {superset && <span className={tag()}>SUPERSET</span>}
            {children}
        </div>
    )
}
