export default defineEventHandler(async (event) => {
    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    const values = parseBodyweightInput(body)

    // One weigh-in per day: logging a date that already exists overwrites its
    // weight rather than erroring or stacking a second point on the chart.
    return useDrizzle()
        .insert(tables.bodyweight)
        .values(values)
        .onConflictDoUpdate({
            target: tables.bodyweight.date,
            set: { weight: values.weight },
        })
        .returning()
        .get()
})
