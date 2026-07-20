import type { ReactNode } from 'react'
import type { VariantProps } from 'tailwind-variants'
import { tv } from 'tailwind-variants'

import type { PrimitiveProps } from '../lib/primitive'
import { Primitive } from '../lib/primitive'

// Muscle-intensity badge: fill encodes how hard the muscle works.
// solid = prime mover, soft = secondary, outline = assists.
const badge = tv({
    base: [
        'inline-flex items-center whitespace-nowrap',
        'border border-transparent px-[9px] py-[3px]',
        'text-micro font-semibold tracking-[0.01em] capitalize',
    ],
    variants: {
        variant: {
            // The global ::selection is accent-on-ink, identical to this fill,
            // so highlighted text would vanish into it. Invert it here.
            solid: 'border-accent-edge bg-accent text-on-accent selection:bg-on-accent selection:text-accent',
            soft: 'border-accent-line-soft bg-accent-tint text-accent-ink',
            outline: 'border-line-2 bg-transparent text-ink-2',
        },
    },
    defaultVariants: { variant: 'outline' },
})

type BadgeVariants = VariantProps<typeof badge>

/**
 * A small capitalized pill, used for muscle intensity: the fill encodes how
 * hard a muscle works. `solid` is the prime mover, `soft` a secondary mover,
 * and `outline` (the default) a muscle that only assists.
 */
export interface BadgeProps extends PrimitiveProps {
    variant?: BadgeVariants['variant']
    className?: string
    children?: ReactNode
}

export function Badge({
    as = 'span',
    variant = 'outline',
    className,
    ...rest
}: BadgeProps) {
    return (
        <Primitive
            as={as}
            className={badge({ variant, className })}
            {...rest}
        />
    )
}
