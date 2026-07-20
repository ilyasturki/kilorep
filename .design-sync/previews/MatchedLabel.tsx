import { Badge, Input, MatchedLabel } from '@kilorep/lift-react'

// Positions are real fuzzyMatch output. When a query lands on an alias instead
// of the name, fuzzyMatch returns empty labelPositions plus the matched keyword,
// which is exactly the shape that makes the parenthesised alias appear.

const stack = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    maxWidth: 400,
}

export function NameMatch() {
    return (
        <div style={{ ...stack, maxWidth: 380 }}>
            <Input
                defaultValue='bench'
                placeholder='Search exercises'
            />
            <span
                className='text-body-lg'
                style={{ marginTop: 2 }}
            >
                <MatchedLabel
                    label='Barbell Bench Press'
                    labelPositions={[8, 9, 10, 11, 12]}
                />
            </span>
        </div>
    )
}

export function AliasMatch() {
    return (
        <div style={{ ...stack, maxWidth: 380 }}>
            <Input
                defaultValue='military'
                placeholder='Search exercises'
            />
            <span
                className='text-body-lg'
                style={{ marginTop: 2 }}
            >
                <MatchedLabel
                    label='Overhead Press'
                    keyword='Military Press'
                    keywordPositions={[0, 1, 2, 3, 4, 5, 6, 7]}
                />
            </span>
        </div>
    )
}

export function PickerResults() {
    const rows = [
        {
            label: 'Barbell Bench Press',
            labelPositions: [14, 15, 16, 17, 18],
            muscle: 'Chest',
        },
        {
            label: 'Overhead Press',
            labelPositions: [9, 10, 11, 12, 13],
            muscle: 'Shoulders',
        },
        {
            label: 'Leg Press',
            labelPositions: [4, 5, 6, 7, 8],
            muscle: 'Quads',
        },
        {
            label: 'Skull Crusher',
            labelPositions: [],
            keyword: 'French Press',
            keywordPositions: [7, 8, 9, 10, 11],
            muscle: 'Triceps',
        },
    ]
    return (
        <div style={{ ...stack, maxWidth: 420 }}>
            <Input
                defaultValue='press'
                placeholder='Search exercises'
            />
            <div style={{ ...stack, gap: 12, marginTop: 2 }}>
                {rows.map((row) => (
                    <div
                        key={row.label}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                        }}
                    >
                        <span className='text-body-lg'>
                            <MatchedLabel
                                label={row.label}
                                labelPositions={row.labelPositions}
                                keyword={row.keyword}
                                keywordPositions={row.keywordPositions}
                            />
                        </span>
                        <Badge variant='soft'>{row.muscle}</Badge>
                    </div>
                ))}
            </div>
        </div>
    )
}

export function AliasList() {
    const rows = [
        {
            label: 'Pec Deck Fly',
            labelPositions: [9, 10, 11],
        },
        {
            label: 'Dumbbell Rear Delt Fly',
            labelPositions: [19, 20, 21],
        },
        {
            label: 'Reverse Pec Deck',
            labelPositions: [],
            keyword: 'Machine Reverse Fly',
            keywordPositions: [16, 17, 18],
        },
    ]
    return (
        <div style={{ ...stack, maxWidth: 400 }}>
            <Input
                defaultValue='fly'
                placeholder='Search exercises'
            />
            <div style={{ ...stack, gap: 12, marginTop: 2 }}>
                {rows.map((row) => (
                    <span
                        key={row.label}
                        className='text-body-lg'
                    >
                        <MatchedLabel
                            label={row.label}
                            labelPositions={row.labelPositions}
                            keyword={row.keyword}
                            keywordPositions={row.keywordPositions}
                        />
                    </span>
                ))}
            </div>
        </div>
    )
}
