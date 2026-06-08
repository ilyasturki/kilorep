// Pull the server's statusMessage off a failed $fetch, falling back when the
// error isn't a structured H3 response.
export function errorMessage(error: unknown, fallback: string): string {
    if (error && typeof error === 'object' && 'data' in error) {
        const data = error.data
        if (data && typeof data === 'object' && 'statusMessage' in data) {
            if (typeof data.statusMessage === 'string')
                return data.statusMessage
        }
    }
    return fallback
}
