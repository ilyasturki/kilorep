import { Button } from '@kilorep/lift-react'

export function Tones() {
    return (
        <div
            style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                alignItems: 'center',
            }}
        >
            <Button tone='primary'>Start workout</Button>
            <Button tone='ghost'>Add exercise</Button>
            <Button tone='danger'>Delete session</Button>
            <Button tone='link'>View history</Button>
        </div>
    )
}

export function Sizes() {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                maxWidth: 320,
            }}
        >
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <Button
                    tone='ghost'
                    size='sm'
                >
                    Add set
                </Button>
                <Button tone='ghost'>Add set</Button>
            </div>
            <Button
                tone='primary'
                size='lg'
            >
                Finish workout
            </Button>
        </div>
    )
}

export function Stretched() {
    return (
        <div style={{ display: 'flex', gap: 12, maxWidth: 420 }}>
            <Button
                tone='ghost'
                className='flex-1'
            >
                Review
            </Button>
            <Button
                tone='danger'
                className='flex-1'
            >
                Discard
            </Button>
        </div>
    )
}

export function Disabled() {
    return (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Button
                tone='primary'
                disabled
            >
                Finish workout
            </Button>
            <Button
                tone='ghost'
                disabled
            >
                Add exercise
            </Button>
        </div>
    )
}
