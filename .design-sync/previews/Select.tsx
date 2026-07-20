import { Field, FieldLabel, Select } from '@kilorep/lift-react'

export function Equipment() {
    return (
        <div style={{ maxWidth: 300 }}>
            <Select
                items={[
                    'barbell',
                    'dumbbell',
                    'machine',
                    'cable',
                    'bodyweight',
                ]}
                value='barbell'
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
                maxWidth: 300,
            }}
        >
            <Select
                items={[
                    { label: 'Chest', value: 'chest' },
                    { label: 'Back', value: 'back' },
                    { label: 'Quads', value: 'quads' },
                    {
                        label: 'Hamstrings',
                        value: 'hamstrings',
                        disabled: true,
                    },
                ]}
                placeholder='Pick a muscle'
            />
            <Select
                items={['kg', 'lb']}
                value='kg'
            />
        </div>
    )
}

export function InField() {
    return (
        <div style={{ maxWidth: 300 }}>
            <Field>
                <FieldLabel>Number &amp; date format</FieldLabel>
                <Select
                    items={[
                        { label: 'Automatic (device)', value: 'auto' },
                        { label: 'English (UK)', value: 'en-GB' },
                        { label: 'Français (France)', value: 'fr-FR' },
                    ]}
                    value='auto'
                />
            </Field>
        </div>
    )
}
