export default defineEventHandler(() => {
    return useDrizzle()
        .select()
        .from(tables.bodyweight)
        .orderBy(asc(tables.bodyweight.date))
        .all()
})
