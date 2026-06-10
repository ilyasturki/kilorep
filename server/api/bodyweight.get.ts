export default defineEventHandler((event) => {
    const userId = requireUserId(event)
    return useDrizzle()
        .select()
        .from(tables.bodyweight)
        .where(eq(tables.bodyweight.userId, userId))
        .orderBy(asc(tables.bodyweight.date))
        .all()
})
