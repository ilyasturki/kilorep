import { Stat } from '@kilorep/lift-react'

export function Single() {
    return (
        <Stat
            value='82.4 kg'
            label='BODY WEIGHT'
        />
    )
}

export function Row() {
    return (
        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
            <Stat
                value='12,480 kg'
                label='VOLUME THIS WEEK'
            />
            <Stat
                value='5'
                label='SESSIONS'
            />
            <Stat
                value='1:04:22'
                label='AVG DURATION'
            />
        </div>
    )
}
