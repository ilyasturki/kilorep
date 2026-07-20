import type { ReactNode } from 'react'
import { tv } from 'tailwind-variants'

import type { PrimitiveProps } from '../lib/primitive'
import { Primitive } from '../lib/primitive'

const fieldLabel = tv({
    base: 'font-mono text-[10.5px] font-semibold tracking-[0.16em] uppercase text-ink-3',
})

/**
 * The caption above a form control: small letter-spaced uppercase monospace.
 * Renders a `<label>` by default, so pass `htmlFor` to bind it to its input.
 */
export interface FieldLabelProps extends PrimitiveProps {
    className?: string
    htmlFor?: string
    children?: ReactNode
}

export function FieldLabel({
    as = 'label',
    className,
    ...rest
}: FieldLabelProps) {
    return (
        <Primitive
            as={as}
            className={fieldLabel({ className })}
            {...rest}
        />
    )
}
