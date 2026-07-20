/**
 * The kilorep mark: a stroked "K" drawn on a 100x100 grid, split so the upper
 * and lower arms each break into a detached outer stroke. It inherits its
 * colour from `currentColor` and carries no intrinsic size, so callers set both
 * through `className` (e.g. `size-[22px] text-accent-ink`). Decorative, so it
 * is `aria-hidden`; label the surrounding element instead.
 */
export interface LogoProps {
    className?: string
}

export function Logo({ className }: LogoProps) {
    return (
        <svg
            className={className}
            viewBox='0 0 100 100'
            fill='none'
            stroke='currentColor'
            strokeWidth='17'
            strokeLinecap='butt'
            strokeLinejoin='miter'
            aria-hidden='true'
        >
            <path d='M24 16 V84 M24 50 L45 36 M52 31 L76 16 M24 50 L45 64 M52 68.5 L76 84' />
        </svg>
    )
}
