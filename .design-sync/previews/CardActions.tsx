import { Button, Card, CardActions, CardHead, Tag } from '@kilorep/lift-react'

// The template card foot: two equal buttons. flex-1 lives on the buttons,
// not on the row, so an unflexed child keeps its intrinsic width.
export function TwoUp() {
    return (
        <div style={{ maxWidth: 420 }}>
            <Card>
                <CardHead>
                    <span className='text-body-lg font-bold'>Upper body A</span>
                    <Tag accent>Template</Tag>
                </CardHead>
                <p className='mt-3 text-body text-ink-2'>
                    5 exercises, 18 sets. Last run Monday.
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

// A workout still running gets one full-width primary; a finished one gets a
// single ghost. Same row, different weight.
export function SingleAction() {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                maxWidth: 420,
            }}
        >
            <Card>
                <CardHead>
                    <span className='text-body-lg font-bold capitalize'>
                        Push day A
                    </span>
                    <Tag accent>In progress</Tag>
                </CardHead>
                <p className='mt-3 font-mono text-label tracking-[0.02em] text-ink-2'>
                    4 exercises · 14 sets · 6,820 kg
                </p>
                <CardActions>
                    <Button className='flex-1'>Resume</Button>
                </CardActions>
            </Card>

            <Card>
                <CardHead>
                    <span className='text-body-lg font-bold capitalize'>
                        Leg day
                    </span>
                    <Tag>Yesterday</Tag>
                </CardHead>
                <p className='mt-3 font-mono text-label tracking-[0.02em] text-ink-2'>
                    4 exercises · 16 sets · 11,900 kg
                </p>
                <CardActions>
                    <Button
                        tone='ghost'
                        className='flex-1'
                    >
                        Review
                    </Button>
                </CardActions>
            </Card>
        </div>
    )
}

// Destructive confirm foot: the danger tone sits in the same row, and an
// unflexed cancel keeps the emphasis on the right.
export function MixedTones() {
    return (
        <div style={{ maxWidth: 420 }}>
            <Card>
                <CardHead>
                    <span className='text-body-lg font-bold'>Leg day</span>
                </CardHead>
                <p className='mt-3 text-body text-ink-2'>
                    Deleting this workout also removes its 16 logged sets. This
                    cannot be undone.
                </p>
                <CardActions>
                    <Button tone='ghost'>Cancel</Button>
                    <Button
                        tone='danger'
                        className='flex-1'
                    >
                        Delete workout
                    </Button>
                </CardActions>
            </Card>
        </div>
    )
}
