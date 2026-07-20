import type { ComponentProps } from 'react'
import type { VariantProps } from 'tailwind-variants'
import { tv } from 'tailwind-variants'

const input = tv({
    base: [
        'w-full border border-line-2 bg-surface px-[13px] py-[11px]',
        'font-[inherit] text-ink outline-none placeholder:text-ink-3',
        'transition-[border-color] duration-[120ms] focus:border-accent',
        // Explicit `text-ink`/`bg-surface` above override the UA's own disabled
        // greying, so without this a disabled input is indistinguishable from an
        // editable one. Matches Button's disabled treatment.
        'disabled:cursor-not-allowed disabled:opacity-45',
    ],
    variants: {
        size: {
            default: 'text-body-lg',
            sm: 'px-2.5 py-[7px] text-body',
        },
    },
    defaultVariants: { size: 'default' },
})

type InputVariants = VariantProps<typeof input>

/**
 * The single-line text field: hairline border on the raised surface, accent
 * border on focus. `default` is the comfortable full-size field, `sm` the
 * compact one for dense rows (set counters, inline renames).
 *
 * Controlled like any React input (`value` + `onChange`); every other native
 * `<input>` attribute passes through, and `ref` reaches the element directly so
 * callers can drive the caret (autofocus-and-select on open, inline rename).
 */
export interface InputProps extends Omit<ComponentProps<'input'>, 'size'> {
    size?: InputVariants['size']
    className?: string
}

export function Input({ size = 'default', className, ...rest }: InputProps) {
    return (
        <input
            className={input({ size, className })}
            {...rest}
        />
    )
}
