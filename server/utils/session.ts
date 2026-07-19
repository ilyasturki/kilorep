import type { H3Event } from 'h3'

/**
 * The single place the sealed cookie is written, so every sign-in path agrees
 * on its shape. Google OAuth is the only one today; the helper exists so a
 * future entry point can't forget `loggedInAt`, which the revocation middleware
 * needs to tell a live session from one issued before the kill switch.
 */
export async function startSession(
    event: H3Event,
    user: {
        id: number
        name: string | null
        email: string | null
        avatarUrl: string | null
    },
): Promise<void> {
    await setUserSession(event, {
        user: {
            id: user.id,
            name: user.name,
            email: user.email,
            avatarUrl: user.avatarUrl,
        },
        // Load-bearing: middleware/1.session-revocation compares this against
        // users.sessionsRevokedAt, so it must be set on every login.
        loggedInAt: new Date().toISOString(),
    })
}
