import type { ElementType } from 'react'
import { Slot } from '@radix-ui/react-slot'

/**
 * React counterpart of reka-ui's `Primitive` — the polymorphic element every
 * Lift component renders through.
 *
 * reka's `asChild` and Radix's `Slot` are the same concept (reka is the Vue
 * port of Radix), so `asChild` delegates to `Slot` rather than reimplementing
 * prop merging.
 */
export interface PrimitiveProps {
    /** Element or component to render. */
    as?: ElementType
    /** Merge props onto the single child instead of emitting a wrapper element. */
    asChild?: boolean
}

/**
 * The escape hatch stays on the function signature rather than on
 * `PrimitiveProps`: components extend that interface into their own public
 * props, and an index signature there would erase the prop contract the design
 * agent reads out of each `<Name>.d.ts`. Here it only permits whatever element
 * `as` resolves to (an `<a>` needs `href`, a `<button>` needs `type`).
 */
type PrimitiveAllProps = PrimitiveProps & Record<string, unknown>

export function Primitive({
    as: As = 'div',
    asChild,
    ...rest
}: PrimitiveAllProps) {
    const Comp = (asChild ? Slot : As) as ElementType
    return <Comp {...rest} />
}
