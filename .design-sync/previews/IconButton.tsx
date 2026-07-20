import { IconButton } from '@kilorep/lift-react'

// The mirror does not export icon components, so the tabler glyphs the real
// call sites use are inlined here at the size those call sites pass (15px).

type GlyphProps = { size?: number }

function svgProps(size: number) {
    return {
        width: size,
        height: size,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 2,
        strokeLinecap: 'round' as const,
        strokeLinejoin: 'round' as const,
        'aria-hidden': true,
    }
}

function PencilIcon({ size = 15 }: GlyphProps) {
    return (
        <svg {...svgProps(size)}>
            <path d='M4 20h4L18.5 9.5a2.828 2.828 0 1 0-4-4L4 16v4' />
            <path d='M13.5 6.5l4 4' />
        </svg>
    )
}

function TrashIcon({ size = 15 }: GlyphProps) {
    return (
        <svg {...svgProps(size)}>
            <path d='M4 7h16' />
            <path d='M10 11v6' />
            <path d='M14 11v6' />
            <path d='M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12' />
            <path d='M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3' />
        </svg>
    )
}

function CheckIcon({ size = 15 }: GlyphProps) {
    return (
        <svg {...svgProps(size)}>
            <path d='M5 12l5 5l10-10' />
        </svg>
    )
}

function ArrowUpIcon({ size = 15 }: GlyphProps) {
    return (
        <svg {...svgProps(size)}>
            <path d='M12 5v14' />
            <path d='M18 11l-6-6' />
            <path d='M6 11l6-6' />
        </svg>
    )
}

function ArrowDownIcon({ size = 15 }: GlyphProps) {
    return (
        <svg {...svgProps(size)}>
            <path d='M12 5v14' />
            <path d='M18 13l-6 6' />
            <path d='M6 13l6 6' />
        </svg>
    )
}

export function RowActions() {
    return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <IconButton
                size='sm'
                aria-label='Edit 12 May 2024'
            >
                <PencilIcon />
            </IconButton>
            <IconButton
                size='sm'
                tone='danger'
                aria-label='Delete 12 May 2024'
            >
                <TrashIcon />
            </IconButton>
        </div>
    )
}

export function Sizes() {
    return (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <IconButton
                size='sm'
                aria-label='Save name'
            >
                <CheckIcon />
            </IconButton>
            <IconButton aria-label='Save name'>
                <CheckIcon size={17} />
            </IconButton>
        </div>
    )
}

export function Disabled() {
    return (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <IconButton
                size='sm'
                disabled
                aria-label='Move Barbell row up'
            >
                <ArrowUpIcon />
            </IconButton>
            <IconButton
                size='sm'
                aria-label='Move Barbell row down'
            >
                <ArrowDownIcon />
            </IconButton>
        </div>
    )
}
