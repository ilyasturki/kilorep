// Shared error throwers, one per status the API uses. Each sets the canonical
// reason phrase explicitly: h3 leaves statusMessage empty when only `message`
// is given, and Nitro then backfills the literal "Server Error" into the
// status line and body of plain client errors.
export function badRequest(message: string): never {
    throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message,
    })
}

export function unauthorized(message: string): never {
    throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
        message,
    })
}

export function notFound(message: string): never {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message })
}

// `data` rides along in the error body for clients that branch on the cause
// (e.g. the exercise delete 409 carries its usage counts for the merge flow).
export function conflict(
    message: string,
    data?: Record<string, unknown>,
): never {
    throw createError({
        statusCode: 409,
        statusMessage: 'Conflict',
        message,
        data,
    })
}
