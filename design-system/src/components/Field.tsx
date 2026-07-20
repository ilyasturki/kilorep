import type { ReactNode } from 'react'
import { tv } from 'tailwind-variants'

import type { PrimitiveProps } from '../lib/primitive'
import { Primitive } from '../lib/primitive'

const field = tv({ base: 'flex flex-col gap-[7px]' })

/**
 * The form row wrapper: stacks a FieldLabel over its control with the standard
 * 7px gap. Carries no styling of its own beyond that spacing.
 */
export interface FieldProps extends PrimitiveProps {
    className?: string
    children?: ReactNode
}

export function Field({ as = 'div', className, ...rest }: FieldProps) {
    return (
        <Primitive
            as={as}
            className={field({ className })}
            {...rest}
        />
    )
}
