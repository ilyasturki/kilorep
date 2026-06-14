import { appLocale } from '~/utils/appLocale'

// Number formatting in the active locale (see utils/appLocale.ts), so reka's
// NumberField input and these readouts share the same decimal/grouping
// separators. Reading appLocale.value keeps callers reactive, so a live locale
// change in Settings reflows them.

// Gym weights: drop trailing zeros so 2.5 -> "2,5" and 100 -> "100".
export const fmtWeight = (n: number) =>
    new Intl.NumberFormat(appLocale.value, {
        maximumFractionDigits: 2,
    }).format(n)

// Bodyweight: always two decimals (80 -> "80,00"). The optional locale override
// lets the Settings preview show a not-yet-applied choice without duplicating
// the format.
export const fmtFixed2 = (n: number, locale = appLocale.value) =>
    new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(n)

// Signed bodyweight delta: leading + on gains, native - on losses, no sign on 0.
export const fmtSigned2 = (n: number) =>
    new Intl.NumberFormat(appLocale.value, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        signDisplay: 'exceptZero',
    }).format(n)

// Session volume: integer with locale grouping (1250 -> "1 250").
export const fmtVolume = (n: number) =>
    new Intl.NumberFormat(appLocale.value, {
        maximumFractionDigits: 0,
    }).format(n)
