/**
 * Ends the session and returns to /login. The cache wipe is security-relevant:
 * it keeps the next account on this browser from reading this one's offline
 * data (see clearUserCaches) — every sign-out path must go through here.
 */
export function useSignOut() {
    const { clear } = useUserSession()
    return async () => {
        await clear()
        await clearUserCaches()
        await navigateTo('/login')
    }
}
