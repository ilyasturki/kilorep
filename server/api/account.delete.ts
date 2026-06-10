// Deletes the account with everything it owns, then clears the session.
// Auth mode only — on a single-user instance "delete my account" would mean
// wiping the whole database, which is the operator's call, not an endpoint's.
export default defineEventHandler(async (event) => {
    requireAuthMode()
    const userId = requireUserId(event)

    useDrizzle().transaction((tx) => {
        // Workouts and sessions first — their trees reference exercises
        // without a cascade, so exercises must go after them.
        tx.delete(tables.workouts)
            .where(eq(tables.workouts.userId, userId))
            .run()
        tx.delete(tables.sessions)
            .where(eq(tables.sessions.userId, userId))
            .run()
        tx.delete(tables.exercises)
            .where(eq(tables.exercises.userId, userId))
            .run()
        tx.delete(tables.bodyweight)
            .where(eq(tables.bodyweight.userId, userId))
            .run()
        tx.delete(tables.users).where(eq(tables.users.id, userId)).run()
    })

    await clearUserSession(event)
    return { ok: true }
})
