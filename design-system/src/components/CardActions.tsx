import type { ReactNode } from 'react'
import { tv } from 'tailwind-variants'

import type { PrimitiveProps } from '../lib/primitive'
import { Primitive } from '../lib/primitive'

// Plain button row at the foot of a card; the buttons themselves carry flex-1.
const cardActions = tv({ base: 'mt-4.5 flex gap-2.5' })

/**
 * The button row at the foot of a Card: 18px top margin, 10px gap, no styling
 * of its own beyond the layout. Buttons placed inside carry their own `flex-1`
 * when they should share the width evenly.
 */
export interface CardActionsProps extends PrimitiveProps {
    className?: string
    children?: ReactNode
}

export function CardActions({
    as = 'div',
    className,
    ...rest
}: CardActionsProps) {
    return (
        <Primitive
            as={as}
            className={cardActions({ className })}
            {...rest}
        />
    )
}
