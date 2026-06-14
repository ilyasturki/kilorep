// Locale options offered in Settings. `value` is the BCP-47 tag handed to Intl
// (number/date formatting) and reka's ConfigProvider (NumberField decimal key,
// DatePicker format). Lives in shared/ so the settings UI and the preferences
// API validate against the same list. null = follow the device (navigator).
export const SUPPORTED_LOCALES = [
    { value: 'fr-FR', label: 'Français (France)' },
    { value: 'en-FR', label: 'English (France)' },
    { value: 'en-US', label: 'English (US)' },
    { value: 'en-GB', label: 'English (UK)' },
    { value: 'de-DE', label: 'Deutsch (Deutschland)' },
] as const

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]['value']

export function isSupportedLocale(value: unknown): value is SupportedLocale {
    return (
        typeof value === 'string'
        && SUPPORTED_LOCALES.some((locale) => locale.value === value)
    )
}
