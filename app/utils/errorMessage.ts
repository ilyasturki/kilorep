// Pull the server's error message off a failed $fetch, falling back when the
// error isn't a structured H3 response.
export function errorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'data' in error) {
        const data = error.data
        if (data && typeof data === 'object' && 'message' in data) {
            if (typeof data.message === 'string' && data.message)
                return data.message
        }
    }
    // No structured server response while offline means the write never
    // reached the server — the missing network is the real cause, so say
    // that instead of the generic failure copy (reads are cached but
    // writes need the server).
    if (import.meta.client && !navigator.onLine) {
        return "You're offline — nothing was saved."
    }
    return fallback
}
