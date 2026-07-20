import type { ReactNode } from 'react'
import type { VariantProps } from 'tailwind-variants'
import { tv } from 'tailwind-variants'

import type { PrimitiveProps } from '../lib/primitive'
import { Primitive } from '../lib/primitive'

const segmented = tv({
    base: 'inline-flex border border-line-2 bg-surface',
    variants: {
        // A multi-option toggle next to an action button is wider than a
        // phone-width row, which drags the layout viewport past the screen (and
        // unseats the fixed tabbar). Stretch it across its own line instead, so
        // the options shrink to fit. The wrapping row needs max-md:flex-wrap.
        stretch: {
            true: 'max-md:flex max-md:[flex:1_1_100%] max-md:[&>*]:flex-1 max-md:[&>*]:px-0 max-md:[&>*]:text-center',
            false: '',
        },
    },
    defaultVariants: { stretch: false },
})

type SegmentedVariants = VariantProps<typeof segmented>

/**
 * The bordered container of a segmented control: a row of SegmentedOption
 * children that reads as one unit, used for view switches and short filters.
 *
 * Selection state lives on the parent, not here (this component only lays the
 * options out). Pass `active` to the chosen SegmentedOption.
 *
 * `stretch` makes the control take its own full-width line below `md`, letting
 * the options shrink to fit rather than overflowing a phone-width row. The row
 * that wraps it needs `max-md:flex-wrap`.
 */
export interface SegmentedProps extends PrimitiveProps {
    stretch?: SegmentedVariants['stretch']
    className?: string
    children?: ReactNode
}

export function Segmented({
    as = 'div',
    stretch = false,
    className,
    ...rest
}: SegmentedProps) {
    return (
        <Primitive
            as={as}
            className={segmented({ stretch, className })}
            {...rest}
        />
    )
}
