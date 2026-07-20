import type { ReactNode } from 'react'
import type { VariantProps } from 'tailwind-variants'
import { tv } from 'tailwind-variants'

import type { PrimitiveProps } from '../lib/primitive'
import { Primitive } from '../lib/primitive'

const option = tv({
    base: [
        'px-4.5 py-[11px] text-body font-semibold capitalize',
        'transition-[color,background] duration-[120ms]',
        // Hairline divider between adjacent options, not around the group.
        '[&:not(:first-child)]:border-l [&:not(:first-child)]:border-l-line-2',
    ],
    variants: {
        active: {
            true: 'bg-accent text-on-accent',
            false: 'text-ink-3 hover:text-ink',
        },
    },
    defaultVariants: { active: false },
})

type SegmentedOptionVariants = VariantProps<typeof option>

/**
 * One choice inside a Segmented control, rendered as a button by default.
 *
 * `active` is the selected look (accent fill), and it is purely presentational:
 * this component holds no state and never toggles itself. The parent owns which
 * option is selected and passes `active` plus an `onClick` accordingly.
 */
export interface SegmentedOptionProps extends PrimitiveProps {
    active?: SegmentedOptionVariants['active']
    className?: string
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    onClick?: () => void
    children?: ReactNode
}

export function SegmentedOption({
    as = 'button',
    active = false,
    className,
    ...rest
}: SegmentedOptionProps) {
    return (
        <Primitive
            as={as}
            className={option({ active, className })}
            {...rest}
        />
    )
}
