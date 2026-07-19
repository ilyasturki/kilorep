declare module '#auth-utils' {
    interface User {
        id: number
        name: string | null
        email: string | null
        avatarUrl: string | null
    }
    interface UserSession {
        // ISO timestamp, compared against users.sessionsRevokedAt by the
        // session-revocation middleware.
        loggedInAt?: string
    }
}

export {}
