import { Badge } from '@kilorep/lift-react'

// Fill encodes how hard the muscle works: solid = prime mover, soft =
// secondary, outline = assists. The app never picks a variant for looks.
export function Variants() {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                maxWidth: 340,
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Badge variant='solid'>chest</Badge>
                <span className='mono text-micro text-ink-3'>
                    solid (prime mover)
                </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Badge variant='soft'>triceps</Badge>
                <span className='mono text-micro text-ink-3'>
                    soft (secondary)
                </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Badge variant='outline'>front delts</Badge>
                <span className='mono text-micro text-ink-3'>
                    outline (assists)
                </span>
            </div>
        </div>
    )
}

// The exercise detail page: every muscle the lift recruits, sorted by
// intensity, so the fill gradient reads as a ranking down the row.
export function MuscleIntensity() {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                maxWidth: 420,
            }}
        >
            <div>
                <span className='kicker mb-2.5 block'>Barbell bench press</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <Badge variant='solid'>chest</Badge>
                    <Badge variant='soft'>front delts</Badge>
                    <Badge variant='soft'>triceps</Badge>
                    <Badge variant='outline'>lats</Badge>
                    <Badge variant='outline'>core</Badge>
                </div>
            </div>
            <div>
                <span className='kicker mb-2.5 block'>Romanian deadlift</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    <Badge variant='solid'>hamstrings</Badge>
                    <Badge variant='solid'>glutes</Badge>
                    <Badge variant='soft'>lower back</Badge>
                    <Badge variant='outline'>forearms</Badge>
                </div>
            </div>
        </div>
    )
}

// TopMuscles: the three-badge rank row that sits under a workout title.
// Position drives the fade (leader solid, then soft, then outline).
export function TopMuscles() {
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
                <span className='text-body-lg font-bold capitalize'>
                    Push day A
                </span>
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        marginTop: 8,
                    }}
                >
                    <Badge variant='solid'>chest</Badge>
                    <Badge variant='soft'>triceps</Badge>
                    <Badge variant='outline'>front delts</Badge>
                </div>
            </div>
            <div>
                <span className='text-body-lg font-bold capitalize'>
                    Pull day B
                </span>
                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        marginTop: 8,
                    }}
                >
                    <Badge variant='solid'>lats</Badge>
                    <Badge variant='soft'>biceps</Badge>
                    <Badge variant='outline'>rear delts</Badge>
                </div>
            </div>
        </div>
    )
}
