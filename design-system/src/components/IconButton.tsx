import type { ReactNode } from 'react'
import type { VariantProps } from 'tailwind-variants'
import { tv } from 'tailwind-variants'

import type { PrimitiveProps } from '../lib/primitive'
import { Primitive } from '../lib/primitive'

const iconButton = tv({
    base: [
        'inline-flex flex-none items-center justify-center',
        'border border-line bg-transparent text-ink',
        'transition-[border-color] duration-[120ms] hover:border-line-2',
        // After the hover rules so a disabled button (e.g. a move arrow at the
        // list edge) doesn't light up under the cursor.
        'disabled:cursor-default disabled:border-line disabled:opacity-35',
    ],
    variants: {
        tone: {
            default: '',
            danger: 'hover:border-red hover:text-red',
        },
        // Separate w-/h- rather than size-*, so a caller overriding just one
        // axis (the settings copy buttons pass h-auto) wins the merge cleanly.
        size: {
            default: 'h-[38px] w-[38px]',
            sm: 'h-8 w-8',
        },
    },
    defaultVariants: { tone: 'default', size: 'default' },
})

type IconButtonVariants = VariantProps<typeof iconButton>

/**
 * A square bordered button holding a single icon (delete, reorder, copy). Pass
 * the icon as `children` and always give it an `aria-label`, since it carries
 * no text. `danger` turns the border and glyph red on hover for destructive
 * actions; `sm` shrinks it from 38px to 32px for dense rows.
 */
export interface IconButtonProps extends PrimitiveProps {
    tone?: IconButtonVariants['tone']
    size?: IconButtonVariants['size']
    className?: string
    disabled?: boolean
    type?: 'button' | 'submit' | 'reset'
    onClick?: () => void
    'aria-label'?: string
    children?: ReactNode
}

export function IconButton({
    as = 'button',
    tone = 'default',
    size = 'default',
    className,
    ...rest
}: IconButtonProps) {
    return (
        <Primitive
            as={as}
            className={iconButton({ tone, size, className })}
            {...rest}
        />
    )
}
