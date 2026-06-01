export default defineEventHandler(async (event) => {
    const body = await readBody<{ weight?: number }>(event)
    const weight = Number(body?.weight)

    if (!Number.isFinite(weight) || weight <= 0) {
        throw createError({
            statusCode: 400,
            statusMessage: 'A positive "weight" is required',
        })
    }

    return useDrizzle()
        .insert(tables.bodyWeights)
        .values({ weight })
        .returning()
        .get()
})
