import { Card, CardHead, IconButton, Stat, Tag } from '@kilorep/lift-react'

function TrashIcon() {
    return (
        <svg
            width='15'
            height='15'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            aria-hidden='true'
        >
            <path d='M4 7h16M10 11v6M14 11v6M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12M9 7V4h6v3' />
        </svg>
    )
}

// The workouts-list head: title on the left, status tag plus the delete
// affordance on the right. Tag size lg exists to match that 32px button.
export function TitleWithStatus() {
    return (
        <div style={{ maxWidth: 460 }}>
            <Card>
                <CardHead>
                    <span className='text-[22px] font-extrabold tracking-[-0.02em] capitalize'>
                        Leg day
                    </span>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                        }}
                    >
                        <Tag size='lg'>Yesterday</Tag>
                        <IconButton
                            type='button'
                            size='sm'
                            tone='danger'
                            aria-label='Delete workout'
                        >
                            <TrashIcon />
                        </IconButton>
                    </div>
                </CardHead>
                <p className='mt-3 font-mono text-label tracking-[0.02em] text-ink-2'>
                    4 exercises · 16 sets · 11,900 kg
                </p>
            </Card>
        </div>
    )
}

// Dashboard panels: a kicker label against a quiet mono link. This is the
// most common shape in the app, and it takes mb-4 from the caller.
export function KickerWithLink() {
    return (
        <div style={{ maxWidth: 460 }}>
            <Card>
                <CardHead className='mb-4'>
                    <span className='kicker'>Recent workouts</span>
                    <a
                        href='#'
                        className='font-mono text-[10.5px] tracking-[0.12em] text-ink-3 uppercase no-underline'
                    >
                        All
                    </a>
                </CardHead>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {[
                        ['Upper body A', '18 sets · 7,240 kg'],
                        ['Leg day', '16 sets · 11,900 kg'],
                        ['Pull day B', '21 sets · 8,650 kg'],
                    ].map(([name, meta]) => (
                        <div
                            key={name}
                            className='flex items-center justify-between gap-3 border-t border-t-line py-3 first:border-t-0'
                        >
                            <span className='text-body font-semibold text-ink'>
                                {name}
                            </span>
                            <span className='mono text-micro text-ink-3'>
                                {meta}
                            </span>
                        </div>
                    ))}
                </div>
            </Card>
        </div>
    )
}

// justify-between with a single child pins it left; the head still supplies
// the baseline alignment for a trailing Stat.
export function TitleWithStat() {
    return (
        <div style={{ maxWidth: 460 }}>
            <Card>
                <CardHead className='mb-4'>
                    <span className='kicker'>Body weight</span>
                    <Stat
                        value='82.4 kg'
                        label='LATEST'
                    />
                </CardHead>
                <p className='text-body text-ink-2'>
                    Down 1.2 kg over the last 30 days, measured every morning
                    before breakfast.
                </p>
            </Card>
        </div>
    )
}
