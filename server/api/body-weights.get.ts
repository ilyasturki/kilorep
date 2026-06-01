export default defineEventHandler(() => {
    return useDrizzle()
        .select()
        .from(tables.bodyWeights)
        .orderBy(desc(tables.bodyWeights.recordedAt))
        .all()
})
