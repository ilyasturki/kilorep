/**
 * Gates the app behind /login when the instance runs with auth configured.
 * Self-hosted instances without OAuth creds skip all of this — the server
 * treats every request as the implicit local user. The mode is probed once
 * and kept in state for the whole visit.
 */
export default defineNuxtRouteMiddleware(async (to) => {
    const authEnabled = useState<boolean | null>('auth-enabled', () => null)
    if (authEnabled.value === null) {
        const mode = await $fetch('/api/auth/mode')
        authEnabled.value = mode.authEnabled
    }

    if (!authEnabled.value) {
        if (to.path === '/login') return navigateTo('/')
        return
    }

    const { loggedIn } = useUserSession()
    if (loggedIn.value) {
        if (to.path === '/login') return navigateTo('/')
        return
    }
    if (to.path !== '/login') return navigateTo('/login')
})
