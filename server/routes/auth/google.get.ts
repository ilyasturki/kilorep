const google = defineOAuthGoogleEventHandler({
    async onSuccess(event, { user: profile }) {
        const user = findOrCreateGoogleUser(profile)
        await setUserSession(event, {
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
            },
        })
        return sendRedirect(event, '/')
    },
    onError(event, error) {
        console.error('[auth] Google OAuth failed', error)
        return sendRedirect(event, '/login?error=oauth')
    },
})

export default defineEventHandler((event) => {
    requireAuthMode()
    return google(event)
})
