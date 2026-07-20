import type { ReactNode } from 'react'
import { tv } from 'tailwind-variants'

import type { PrimitiveProps } from '../lib/primitive'
import { Primitive } from '../lib/primitive'

const empty = tv({
    base: 'border border-dashed border-line-2 px-5 py-10 text-center text-body text-ink-2',
})

/**
 * The empty state placeholder: a dashed outline holding centred muted text,
 * shown where a list or card would be once it has content.
 */
export interface EmptyProps extends PrimitiveProps {
    className?: string
    children?: ReactNode
}

export function Empty({ as = 'div', className, ...rest }: EmptyProps) {
    return (
        <Primitive
            as={as}
            className={empty({ className })}
            {...rest}
        />
    )
}
