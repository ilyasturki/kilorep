import { appLocale } from '~/utils/appLocale'

// Day formatting in the active locale (see utils/appLocale.ts), kept in step
// with the reka DatePicker and number readouts. The optional locale override
// lets the Settings preview show a not-yet-applied choice.
export const fmtDate = (d: string | Date, locale = appLocale.value) =>
    new Date(d).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })

export const fmtDateShort = (d: string | Date) =>
    new Date(d).toLocaleDateString(appLocale.value, {
        day: 'numeric',
        month: 'short',
    })

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
