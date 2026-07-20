/**
 * The handful of Tabler glyphs Lift's own components render inline.
 *
 * The Vue app pulls these from @nuxt/icon at runtime; inlining the three paths
 * keeps the mirror's bundle self-contained, which is what the design runtime
 * requires (no network, no icon registry).
 */
import type { SVGProps } from 'react'

function Glyph({
    size = 18,
    children,
    ...rest
}: SVGProps<SVGSVGElement> & { size?: number }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth={2}
            strokeLinecap='round'
            strokeLinejoin='round'
            aria-hidden='true'
            {...rest}
        >
            {children}
        </svg>
    )
}

export function IconX(props: SVGProps<SVGSVGElement> & { size?: number }) {
    return (
        <Glyph {...props}>
            <path d='M18 6 6 18M6 6l12 12' />
        </Glyph>
    )
}

export function IconChevronDown(
    props: SVGProps<SVGSVGElement> & { size?: number },
) {
    return (
        <Glyph {...props}>
            <path d='m6 9 6 6 6-6' />
        </Glyph>
    )
}

export function IconCheck(props: SVGProps<SVGSVGElement> & { size?: number }) {
    return (
        <Glyph {...props}>
            <path d='m5 12 5 5L20 7' />
        </Glyph>
    )
}
