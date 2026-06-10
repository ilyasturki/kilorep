declare module '#auth-utils' {
    interface User {
        id: number
        name: string | null
        email: string | null
        avatarUrl: string | null
    }
}

export {}
