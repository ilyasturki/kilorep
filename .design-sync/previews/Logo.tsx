import { Logo } from '@kilorep/lift-react'

// The mark carries no intrinsic size or colour: every real call site sets both
// through className, so these cells use the exact classes the app passes.

export function Sizes() {
    return (
        <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end' }}>
            <Logo className='size-[22px] flex-none' />
            <Logo className='size-[30px] flex-none' />
            <Logo className='size-[34px] flex-none' />
        </div>
    )
}

export function Accent() {
    return (
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <Logo className='size-[30px] flex-none' />
            <Logo className='size-[30px] flex-none text-accent' />
        </div>
    )
}

export function InBrandLockup() {
    return (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Logo className='size-[30px] flex-none text-accent' />
            <span
                style={{
                    fontSize: 24,
                    fontWeight: 800,
                    letterSpacing: '-0.03em',
                }}
            >
                Lift
            </span>
        </div>
    )
}
