/**
 * Gates the app behind /login when the instance runs with auth configured.
 * Self-hosted instances without OAuth creds skip all of this — the server
 * treats every request as the implicit local user. The mode is probed once
 * and kept in state for the whole visit.
 */
export default defineNuxtRouteMiddleware(async (to) => {
    const authEnabled = useAuthEnabled()
    if (authEnabled.value === null) {
        const mode = await $fetch('/api/auth/mode')
        authEnabled.value = mode.authEnabled
    }

    const gated = authEnabled.value && !useUserSession().loggedIn.value
    if (gated && to.path !== '/login') return navigateTo('/login')
    if (!gated && to.path === '/login') return navigateTo('/')
})
