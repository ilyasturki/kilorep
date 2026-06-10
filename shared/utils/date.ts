export const pad = (n: number) => String(n).padStart(2, '0')

// 'YYYY-MM-DD' for a date in the LOCAL timezone (never UTC) — form inputs,
// the bodyweight store and the MCP tools all key off the same calendar day,
// so app and server must format it identically.
export const toDateInput = (d: string | Date) => {
    const date = new Date(d)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
