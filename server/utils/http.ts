// Throws a 400 with the given message. Shared by the input parsers so a rejected
// payload always surfaces the same status.
export function badRequest(message: string): never {
    throw createError({ statusCode: 400, statusMessage: message })
}
