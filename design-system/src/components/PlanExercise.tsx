import { tv } from 'tailwind-variants'

import { Primitive } from '../lib/primitive'

// A numbered exercise line inside a PlanBlock: index, name, target summary.
// Given `to` it becomes a link to that exercise's history, tinting the name on
// hover rather than carrying link chrome into the dense list.
const planExercise = tv({
    slots: {
        root: 'grid grid-cols-[28px_1fr_auto] items-center gap-3 py-[11px]',
        index: 'font-mono text-label text-ink-3',
        name: 'text-body-lg font-medium capitalize',
        target: 'font-mono text-label text-ink-2',
    },
    variants: {
        link: {
            true: {
                root: 'text-inherit no-underline',
                name: 'group-hover/plan-ex:text-accent-ink',
            },
        },
    },
})

/**
 * A numbered exercise line inside a PlanBlock, laid out as index / name /
 * target across one row (for example "1", "bench press", "3 x 8").
 *
 * Passing `to` turns the row into a link to that exercise's history: it renders
 * an anchor and tints the name on hover, instead of carrying visible link
 * chrome into the dense list. Without `to` it is a plain row.
 */
export interface PlanExerciseProps {
    index: string | number
    name: string
    target?: string
    /** Href for the exercise's history. Its presence is what makes the row a link. */
    to?: string
    className?: string
}

export function PlanExercise({
    index,
    name,
    target,
    to,
    className,
}: PlanExerciseProps) {
    const slots = planExercise({ link: to != null })
    const rootClass = [slots.root({ className }), to && 'group/plan-ex']
        .filter(Boolean)
        .join(' ')
    return (
        <Primitive
            as={to ? 'a' : 'div'}
            href={to}
            className={rootClass}
        >
            <span className={slots.index()}>{index}</span>
            <span className={slots.name()}>{name}</span>
            <span className={slots.target()}>{target}</span>
        </Primitive>
    )
}
