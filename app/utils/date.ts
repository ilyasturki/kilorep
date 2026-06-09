// Locale-aware day formatting shared across the workout and exercise views.
export const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })

export const fmtDateShort = (d: string | Date) =>
    new Date(d).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
    })
