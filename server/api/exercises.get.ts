export default defineEventHandler(() => {
    return useDrizzle()
        .select()
        .from(tables.exercises)
        .orderBy(asc(tables.exercises.muscles), asc(tables.exercises.name))
        .all()
})
