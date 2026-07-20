import { Field, FieldLabel, Input, Select } from '@kilorep/lift-react'

export function Labelled() {
    return (
        <div style={{ maxWidth: 380 }}>
            <Field>
                <FieldLabel htmlFor='field-name'>Exercise</FieldLabel>
                <Input
                    id='field-name'
                    value='Romanian deadlift'
                    readOnly
                />
            </Field>
        </div>
    )
}

export function Stacked() {
    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                maxWidth: 380,
            }}
        >
            <Field>
                <FieldLabel htmlFor='field-stacked-name'>
                    Name <span className='text-accent-ink'>*</span>
                </FieldLabel>
                <Input
                    id='field-stacked-name'
                    value='Incline dumbbell press'
                    readOnly
                />
            </Field>
            <Field>
                <FieldLabel>Equipment</FieldLabel>
                <Select
                    items={[
                        'barbell',
                        'dumbbell',
                        'machine',
                        'cable',
                        'bodyweight',
                    ]}
                    value='dumbbell'
                />
            </Field>
            <Field>
                <FieldLabel htmlFor='field-stacked-note'>Note</FieldLabel>
                <Input
                    id='field-stacked-note'
                    size='sm'
                    placeholder='Felt heavy'
                    value=''
                    readOnly
                />
            </Field>
        </div>
    )
}

export function Row() {
    return (
        <div
            style={{
                display: 'flex',
                gap: 24,
                alignItems: 'flex-start',
                flexWrap: 'wrap',
            }}
        >
            <div style={{ width: 176 }}>
                <Field>
                    <FieldLabel>Muscle</FieldLabel>
                    <Select
                        items={[
                            { label: 'Chest', value: 'chest' },
                            { label: 'Back', value: 'back' },
                            { label: 'Quads', value: 'quads' },
                        ]}
                        value='back'
                    />
                </Field>
            </div>
            <div style={{ width: 128 }}>
                <Field>
                    <FieldLabel>Intensity</FieldLabel>
                    <Select
                        items={['high', 'medium', 'low']}
                        value='high'
                    />
                </Field>
            </div>
        </div>
    )
}
