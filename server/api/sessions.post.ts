export default defineEventHandler(async (event) => {
    const parsed = parseSessionInput(await readBody<SessionInput>(event))

    return useDrizzle().transaction((tx) => {
        const session = tx
            .insert(tables.sessions)
            .values({ name: parsed.name })
            .returning()
            .get()

        writeSessionEntries(tx, session.id, parsed.entries)
        return session
    })
})
