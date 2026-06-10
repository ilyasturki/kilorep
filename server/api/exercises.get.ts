export default defineEventHandler((event) => {
    const userId = requireUserId(event)
    return useDrizzle()
        .select()
        .from(tables.exercises)
        .where(eq(tables.exercises.userId, userId))
        .orderBy(asc(tables.exercises.id))
        .all()
})
