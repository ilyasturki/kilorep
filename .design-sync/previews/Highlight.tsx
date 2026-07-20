import { Badge, Highlight, Input } from '@kilorep/lift-react'

// Match positions are real output from app/utils/fuzzy.ts (fuzzyMatch of the
// query against the catalog name), not hand-placed indices.

const stack = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    maxWidth: 380,
}

const resultRow = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
}

export function SearchResults() {
    return (
        <div style={stack}>
            <Input
                defaultValue='press'
                placeholder='Search exercises'
            />
            <div style={{ ...stack, gap: 12, marginTop: 2 }}>
                <div style={resultRow}>
                    <span className='text-body-lg'>
                        <Highlight
                            text='Barbell Bench Press'
                            positions={[14, 15, 16, 17, 18]}
                        />
                    </span>
                    <Badge variant='soft'>Chest</Badge>
                </div>
                <div style={resultRow}>
                    <span className='text-body-lg'>
                        <Highlight
                            text='Overhead Press'
                            positions={[9, 10, 11, 12, 13]}
                        />
                    </span>
                    <Badge variant='soft'>Shoulders</Badge>
                </div>
                <div style={resultRow}>
                    <span className='text-body-lg'>
                        <Highlight
                            text='Incline Dumbbell Press'
                            positions={[17, 18, 19, 20, 21]}
                        />
                    </span>
                    <Badge variant='soft'>Chest</Badge>
                </div>
                <div style={resultRow}>
                    <span className='text-body-lg'>
                        <Highlight
                            text='Leg Press'
                            positions={[4, 5, 6, 7, 8]}
                        />
                    </span>
                    <Badge variant='soft'>Quads</Badge>
                </div>
            </div>
        </div>
    )
}

export function MatchShapes() {
    const rows = [
        {
            query: 'bench',
            text: 'Barbell Bench Press',
            positions: [8, 9, 10, 11, 12],
        },
        { query: 'bp', text: 'Barbell Bench Press', positions: [0, 14] },
        { query: 'rdl', text: 'Romanian Deadlift', positions: [0, 9, 13] },
        {
            query: 'incl db',
            text: 'Incline Dumbbell Press',
            positions: [0, 1, 2, 3, 8, 11],
        },
    ]
    return (
        <div style={{ ...stack, maxWidth: 420 }}>
            {rows.map((row) => (
                <div
                    key={row.query}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: '72px 1fr',
                        alignItems: 'center',
                        gap: 14,
                    }}
                >
                    {/* The typed query verbatim: Badge would capitalize it. */}
                    <span className='mono text-label text-ink-3'>
                        {row.query}
                    </span>
                    <span className='text-body-lg'>
                        <Highlight
                            text={row.text}
                            positions={row.positions}
                        />
                    </span>
                </div>
            ))}
        </div>
    )
}

export function DenseRow() {
    return (
        <div style={{ ...stack, gap: 0, maxWidth: 340 }}>
            {[
                {
                    text: 'Barbell Row',
                    positions: [8, 9, 10],
                    muscle: 'Back',
                },
                {
                    text: 'Dumbbell Row',
                    positions: [9, 10, 11],
                    muscle: 'Back',
                },
                {
                    text: 'Seated Cable Row',
                    positions: [13, 14, 15],
                    muscle: 'Back',
                },
                {
                    text: 'Chest-Supported Row',
                    positions: [16, 17, 18],
                    muscle: 'Rear delts',
                },
            ].map((row) => (
                <div
                    key={row.text}
                    style={{
                        ...resultRow,
                        padding: '8px 0',
                    }}
                >
                    <span className='text-body'>
                        <Highlight
                            text={row.text}
                            positions={row.positions}
                        />
                    </span>
                    <Badge variant='outline'>{row.muscle}</Badge>
                </div>
            ))}
        </div>
    )
}
