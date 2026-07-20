import { Field, FieldLabel, Input } from '@kilorep/lift-react'

export function Basic() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FieldLabel>Exercise</FieldLabel>
            <FieldLabel>Body weight</FieldLabel>
            <FieldLabel>Rest between sets</FieldLabel>
        </div>
    )
}

export function Required() {
    return (
        <div style={{ maxWidth: 380 }}>
            <Field>
                <FieldLabel htmlFor='label-name'>
                    Name <span className='text-accent-ink'>*</span>
                </FieldLabel>
                <Input
                    id='label-name'
                    value='Overhead press'
                    readOnly
                />
            </Field>
        </div>
    )
}
