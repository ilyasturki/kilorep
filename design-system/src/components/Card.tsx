import type { ReactNode } from 'react'
import { tv } from 'tailwind-variants'

import type { PrimitiveProps } from '../lib/primitive'
import { Primitive } from '../lib/primitive'

const card = tv({ base: 'border border-line-2 bg-surface p-6' })

/** The standard surface container: hairline border, raised surface, 24px padding. */
export interface CardProps extends PrimitiveProps {
    className?: string
    children?: ReactNode
}

export function Card({ as = 'div', className, ...rest }: CardProps) {
    return (
        <Primitive
            as={as}
            className={card({ className })}
            {...rest}
        />
    )
}
