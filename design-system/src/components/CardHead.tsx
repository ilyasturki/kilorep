import type { ReactNode } from 'react'
import { tv } from 'tailwind-variants'

import type { PrimitiveProps } from '../lib/primitive'
import { Primitive } from '../lib/primitive'

// max-md:flex-wrap lets a stretched Segmented drop onto its own line rather
// than pushing the row past a phone-width viewport.
const cardHead = tv({
    base: 'flex flex-wrap items-center justify-between gap-3 md:flex-nowrap',
})

/**
 * The header row of a Card: a title on the left and controls on the right,
 * pushed apart by `justify-between`. It wraps below the `md` breakpoint so a
 * wide control (a stretched Segmented) drops onto its own line on phones
 * instead of overflowing the viewport.
 */
export interface CardHeadProps extends PrimitiveProps {
    className?: string
    children?: ReactNode
}

export function CardHead({ as = 'div', className, ...rest }: CardHeadProps) {
    return (
        <Primitive
            as={as}
            className={cardHead({ className })}
            {...rest}
        />
    )
}
