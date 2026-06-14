// The signed-in user's display preferences. Scoped by userId, so it answers in
// both auth modes. Web-only, so it stays out of the OpenAPI/Android contract.
export default defineEventHandler((event) => {
    const userId = requireUserId(event)
    return { locale: getUserLocale(userId) }
})
