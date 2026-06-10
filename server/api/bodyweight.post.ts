export default defineEventHandler(async (event) => {
    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    return upsertBodyweight(parseBodyweightInput(body))
})
