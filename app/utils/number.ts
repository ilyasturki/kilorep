import { appLocale } from '~/utils/appLocale'

// Number formatting in the active locale (see utils/appLocale.ts), so reka's
// NumberField input and these readouts share the same decimal/grouping
// separators. Reading appLocale.value keeps callers reactive, so a live locale
// change in Settings reflows them.

// Constructing an Intl.NumberFormat costs far more than calling .format(), and
// these run in render/tooltip loops (set chips, chart points), so cache one
// formatter per locale and reuse it. The locale only changes on a Settings
// switch, so the cache stays tiny.
const numberFormat = (options: Intl.NumberFormatOptions) => {
    const byLocale = new Map<string | undefined, Intl.NumberFormat>()
    return (locale: string | undefined) => {
        let fmt = byLocale.get(locale)
        if (!fmt)
            byLocale.set(locale, (fmt = new Intl.NumberFormat(locale, options)))
        return fmt
    }
}

// Gym weights: drop trailing zeros so 2.5 -> "2,5" and 100 -> "100".
const weightFmt = numberFormat({ maximumFractionDigits: 2 })
export const fmtWeight = (n: number) => weightFmt(appLocale.value).format(n)

// Bodyweight: always two decimals (80 -> "80,00"). The optional locale override
// lets the Settings preview show a not-yet-applied choice without duplicating
// the format.
const fixed2Fmt = numberFormat({
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
})
export const fmtFixed2 = (n: number, locale = appLocale.value) =>
    fixed2Fmt(locale).format(n)

// Signed bodyweight delta: leading + on gains, native - on losses, no sign on 0.
const signed2Fmt = numberFormat({
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'exceptZero',
})
export const fmtSigned2 = (n: number) => signed2Fmt(appLocale.value).format(n)

// Session volume: integer with locale grouping (1250 -> "1 250").
const volumeFmt = numberFormat({ maximumFractionDigits: 0 })
export const fmtVolume = (n: number) => volumeFmt(appLocale.value).format(n)
