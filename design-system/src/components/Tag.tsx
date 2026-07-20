import type { ReactNode } from 'react'
import type { VariantProps } from 'tailwind-variants'
import { tv } from 'tailwind-variants'

import type { PrimitiveProps } from '../lib/primitive'
import { Primitive } from '../lib/primitive'

const tag = tv({
    base: [
        'inline-flex items-center gap-[5px] whitespace-nowrap',
        'border border-line bg-surface-2 px-2 py-1',
        'font-mono text-[10.5px] font-semibold tracking-[0.08em] uppercase text-ink-2',
    ],
    variants: {
        accent: {
            true: 'border-accent-line text-accent-ink',
            false: '',
        },
        // Sits beside a 32px delete icon button in the workout card header;
        // matching its height keeps the row from floating short.
        size: {
            default: '',
            lg: 'h-8 py-0',
        },
    },
    defaultVariants: { accent: false, size: 'default' },
})

type TagVariants = VariantProps<typeof tag>

/**
 * An uppercase monospace label for metadata (equipment, muscle group, set
 * count). `accent` tints it with the volt accent to mark the active or primary
 * one; `lg` raises it to 32px so it lines up with the icon buttons it sits
 * beside in a card header.
 */
export interface TagProps extends PrimitiveProps {
    accent?: boolean
    size?: TagVariants['size']
    className?: string
    children?: ReactNode
}

export function Tag({
    as = 'span',
    accent = false,
    size = 'default',
    className,
    ...rest
}: TagProps) {
    return (
        <Primitive
            as={as}
            className={tag({ accent, size, className })}
            {...rest}
        />
    )
}
