import { appLocale } from '~/utils/appLocale'

// Day formatting in the active locale (see utils/appLocale.ts), kept in step
// with the reka DatePicker and number readouts. Constructing a date formatter
// is costly and these run over lists, so cache one per locale and reuse it.
const dateFormat = (options: Intl.DateTimeFormatOptions) => {
    const byLocale = new Map<string | undefined, Intl.DateTimeFormat>()
    return (locale: string | undefined) => {
        let fmt = byLocale.get(locale)
        if (!fmt)
            byLocale.set(
                locale,
                (fmt = new Intl.DateTimeFormat(locale, options)),
            )
        return fmt
    }
}

// The optional locale override lets the Settings preview show a not-yet-applied
// choice.
const fullFmt = dateFormat({ day: 'numeric', month: 'short', year: 'numeric' })
export const fmtDate = (d: string | Date, locale = appLocale.value) =>
    fullFmt(locale).format(new Date(d))

const shortFmt = dateFormat({ day: 'numeric', month: 'short' })
export const fmtDateShort = (d: string | Date) =>
    shortFmt(appLocale.value).format(new Date(d))

// Inverse of toDateInput (shared/utils/date.ts): parse a 'YYYY-MM-DD' day to a Date at LOCAL midnight,
// so the rendered day always matches the stored day whatever the runtime tz.
export const parseLocalDay = (d: string) => new Date(`${d}T00:00:00`)

const startOfDay = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()

// Quick-scan label for recent days — "Today", "Yesterday", "3 days ago" — then
// the absolute date once it's a week out, where the day count stops being handy.
// `now` is injected (not read off the clock) so callers can pass a client-only
// value and keep SSR markup stable; compared by calendar day, not 24h spans.
export const fmtRelativeDay = (d: string | Date, now: Date) => {
    const days = Math.round(
        (startOfDay(now) - startOfDay(new Date(d))) / 86_400_000,
    )
    if (days <= 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return fmtDate(d)
}
