import type { ReactNode } from 'react'
import type { VariantProps } from 'tailwind-variants'
import { tv } from 'tailwind-variants'

import type { PrimitiveProps } from '../lib/primitive'
import { Primitive } from '../lib/primitive'

const button = tv({
    // `justify-center` is in the base rather than per-tone: it is inert at the
    // natural width every tone normally renders at, and only bites when a caller
    // stretches the button (`flex-1`, `w-full`), where a left-hugging label reads
    // as a bug.
    base: 'inline-flex items-center justify-center',
    variants: {
        // Disabled styling is per-tone rather than shared: only primary and
        // ghost ever render disabled, and the two use different opacities.
        tone: {
            primary: [
                'gap-2 border-none bg-accent px-4.5 py-3',
                'text-body-lg font-extrabold tracking-[-0.01em] text-on-accent',
                '[transition:filter_0.15s,transform_0.08s]',
                'hover:brightness-[1.06] active:scale-[0.99]',
                'disabled:cursor-not-allowed disabled:opacity-45',
            ],
            ghost: [
                'gap-[7px] border border-line-2 bg-transparent px-[15px] py-2.5',
                'text-body font-semibold text-ink',
                'transition-[background] duration-[120ms] hover:bg-surface-2',
                'disabled:cursor-not-allowed disabled:opacity-45',
            ],
            danger: [
                'gap-[7px] border-none bg-red px-4 py-2.5',
                'text-body font-extrabold text-on-red',
                'transition-[filter] duration-150 hover:brightness-[1.08]',
            ],
            link: [
                'gap-1.5 border-none bg-transparent px-0 py-1',
                'text-body-sm font-semibold text-ink-2',
                'transition-[color] duration-[120ms] hover:text-accent-ink',
            ],
        },
        // Declared after `tone` so its padding and size win the merge.
        size: {
            default: '',
            sm: 'px-[11px] py-[7px] text-body-sm',
            lg: 'h-13 w-full text-base',
        },
    },
    defaultVariants: { tone: 'primary', size: 'default' },
})

type ButtonVariants = VariantProps<typeof button>

/**
 * The primary action control. `primary` is the volt-accent call to action,
 * `ghost` the bordered secondary, `danger` the destructive red, and `link` a
 * borderless inline action.
 */
export interface ButtonProps extends PrimitiveProps {
    tone?: ButtonVariants['tone']
    size?: ButtonVariants['size']
    className?: string
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    onClick?: () => void
    children?: ReactNode
}

export function Button({
    as = 'button',
    tone = 'primary',
    size = 'default',
    className,
    ...rest
}: ButtonProps) {
    return (
        <Primitive
            as={as}
            className={button({ tone, size, className })}
            {...rest}
        />
    )
}
