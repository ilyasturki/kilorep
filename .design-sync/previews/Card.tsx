import {
    Badge,
    Button,
    Card,
    CardActions,
    CardHead,
    PlanBlock,
    PlanExercise,
    Stat,
    Tag,
} from '@kilorep/lift-react'

// The workouts-list card, whole: head row, muscle rank badges, totals line,
// the plan readout, then the action footer.
export function WorkoutCard() {
    return (
        <div style={{ maxWidth: 460 }}>
            <Card>
                <CardHead>
                    <span className='text-[22px] font-extrabold tracking-[-0.02em] capitalize'>
                        Push day A
                    </span>
                    <Tag
                        size='lg'
                        accent
                    >
                        In progress
                    </Tag>
                </CardHead>

                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: 6,
                        marginTop: 12,
                    }}
                >
                    <Badge variant='solid'>chest</Badge>
                    <Badge variant='soft'>triceps</Badge>
                    <Badge variant='outline'>front delts</Badge>
                </div>

                <p className='mt-2.5 font-mono text-label tracking-[0.02em] text-ink-2'>
                    4 exercises · 14 sets · 6,820 kg
                </p>

                <div className='mt-3.5 border-t border-t-line pt-1'>
                    <PlanBlock>
                        <PlanExercise
                            index='01'
                            name='Barbell bench press'
                            target='4 x 8 @ 80 kg'
                        />
                    </PlanBlock>
                    <PlanBlock superset>
                        <PlanExercise
                            index='02'
                            name='Incline dumbbell press'
                            target='3 x 10 @ 28 kg'
                        />
                        <PlanExercise
                            index='03'
                            name='Cable fly'
                            target='3 x 12 @ 15 kg'
                        />
                    </PlanBlock>
                    <PlanBlock>
                        <PlanExercise
                            index='04'
                            name='Overhead triceps extension'
                            target='3 x 12 @ 22.5 kg'
                        />
                    </PlanBlock>
                </div>

                <CardActions>
                    <Button className='flex-1'>Resume</Button>
                </CardActions>
            </Card>
        </div>
    )
}

// A card used purely as a surface for a stat row (the dashboard summary tile).
export function StatsCard() {
    return (
        <div style={{ maxWidth: 460 }}>
            <Card>
                <CardHead className='mb-4'>
                    <span className='kicker'>This week</span>
                    <span className='mono text-micro text-ink-3'>
                        Jul 13 - Jul 19
                    </span>
                </CardHead>
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: 16,
                    }}
                >
                    <Stat
                        value='12,480'
                        label='VOLUME (KG)'
                    />
                    <Stat
                        value='5'
                        label='SESSIONS'
                    />
                    <Stat
                        value='1:04'
                        label='AVG TIME'
                    />
                </div>
            </Card>
        </div>
    )
}

// Two cards side by side: the p-6 padding and hairline border are the whole
// component, so the useful check is that they tile evenly.
export function CardGrid() {
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: 16,
                maxWidth: 640,
            }}
        >
            <Card>
                <CardHead>
                    <span className='text-body-lg font-bold'>Upper body A</span>
                    <Tag accent>Template</Tag>
                </CardHead>
                <p className='mt-3 text-body text-ink-2'>
                    5 exercises, 18 sets. Last run Monday at 7,240 kg total
                    volume.
                </p>
                <CardActions>
                    <Button className='flex-1'>Start</Button>
                    <Button
                        tone='ghost'
                        className='flex-1'
                    >
                        Edit
                    </Button>
                </CardActions>
            </Card>
            <Card>
                <CardHead>
                    <span className='text-body-lg font-bold'>Leg day</span>
                    <Tag accent>Template</Tag>
                </CardHead>
                <p className='mt-3 text-body text-ink-2'>
                    4 exercises, 16 sets. Last run Thursday at 11,900 kg total
                    volume.
                </p>
                <CardActions>
                    <Button className='flex-1'>Start</Button>
                    <Button
                        tone='ghost'
                        className='flex-1'
                    >
                        Edit
                    </Button>
                </CardActions>
            </Card>
        </div>
    )
}
