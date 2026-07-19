const google = defineOAuthGoogleEventHandler({
    async onSuccess(event, { user: profile }) {
        const user = findOrCreateGoogleUser(profile)
        await startSession(event, user)
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
