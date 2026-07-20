import { Tag } from '@kilorep/lift-react'

function CalendarIcon() {
    return (
        <svg
            width='13'
            height='13'
            viewBox='0 0 24 24'
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
            aria-hidden='true'
        >
            <rect
                x='4'
                y='5'
                width='16'
                height='16'
                rx='2'
            />
            <path d='M16 3v4M8 3v4M4 11h16' />
        </svg>
    )
}

export function Variants() {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                maxWidth: 360,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Tag>3 exercises</Tag>
                <span className='mono text-micro text-ink-3'>default</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Tag accent>In progress</Tag>
                <span className='mono text-micro text-ink-3'>
                    accent (live session)
                </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Tag size='lg'>
                    <CalendarIcon />
                    Push day
                </Tag>
                <span className='mono text-micro text-ink-3'>
                    lg (32px, matches an icon button)
                </span>
            </div>
        </div>
    )
}

// Dashboard recent-workouts list: accent marks the one session still running,
// every finished row falls back to a plain day label.
export function WorkoutStatus() {
    const rows = [
        {
            name: 'Upper body A',
            meta: '5 exercises · 18 sets · 7,240 kg',
            status: 'In progress',
            live: true,
        },
        {
            name: 'Leg day',
            meta: '4 exercises · 16 sets · 11,900 kg',
            status: 'Yesterday',
            live: false,
        },
        {
            name: 'Pull day B',
            meta: '6 exercises · 21 sets · 8,650 kg',
            status: 'Mon',
            live: false,
        },
    ]
    return (
        <div style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                {rows.map((row) => (
                    <div
                        key={row.name}
                        className='flex items-center justify-between gap-3 border-t border-t-line py-3 first:border-t-0'
                    >
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 3,
                                minWidth: 0,
                            }}
                        >
                            <span className='text-body font-semibold text-ink'>
                                {row.name}
                            </span>
                            <span className='mono text-micro text-ink-3'>
                                {row.meta}
                            </span>
                        </div>
                        <Tag accent={row.live}>{row.status}</Tag>
                    </div>
                ))}
            </div>
        </div>
    )
}

// Exercise catalog row: equipment is always neutral, accent flags a compound.
export function ExerciseMeta() {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                maxWidth: 380,
            }}
        >
            <div>
                <span className='text-body font-semibold'>Barbell squat</span>
                <div style={{ display: 'flex', gap: 7, marginTop: 7 }}>
                    <Tag>Barbell</Tag>
                    <Tag accent>Compound</Tag>
                </div>
            </div>
            <div>
                <span className='text-body font-semibold'>
                    Cable triceps pushdown
                </span>
                <div style={{ display: 'flex', gap: 7, marginTop: 7 }}>
                    <Tag>Cable</Tag>
                    <Tag>Isolation</Tag>
                </div>
            </div>
            <div>
                <span className='text-body font-semibold'>
                    Weighted pull-up
                </span>
                <div style={{ display: 'flex', gap: 7, marginTop: 7 }}>
                    <Tag>Bodyweight</Tag>
                    <Tag accent>Compound</Tag>
                </div>
            </div>
        </div>
    )
}
