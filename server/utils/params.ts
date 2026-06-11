import type { H3Event } from 'h3'

// Reads the `:id` route param as a positive integer, throwing a 400 otherwise.
export function getIdParam(event: H3Event, resource: string): number {
    const id = Number(getRouterParam(event, 'id'))
    if (!Number.isInteger(id) || id <= 0) {
        badRequest(`Invalid ${resource} id`)
    }
    return id
}
