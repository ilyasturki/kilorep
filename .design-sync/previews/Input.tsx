import { Input } from '@kilorep/lift-react'

export function Sizes() {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                maxWidth: 380,
            }}
        >
            <Input
                value='Romanian deadlift'
                readOnly
            />
            <Input
                size='sm'
                value='Felt heavy, drop to 90 kg next week'
                readOnly
            />
        </div>
    )
}

export function Placeholder() {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                maxWidth: 380,
            }}
        >
            <Input
                placeholder='Search exercises'
                value=''
                readOnly
            />
            <Input
                size='sm'
                placeholder='Felt heavy'
                value=''
                readOnly
            />
        </div>
    )
}

export function Disabled() {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                maxWidth: 380,
            }}
        >
            <Input
                value='Barbell bench press'
                readOnly
            />
            <Input
                value='Barbell bench press'
                disabled
            />
        </div>
    )
}

export function Focused() {
    return (
        <div style={{ maxWidth: 380 }}>
            <Input
                value='Barbell bench press'
                autoFocus
                readOnly
            />
        </div>
    )
}
