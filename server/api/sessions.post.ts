export default defineEventHandler(async (event) => {
    const userId = requireUserId(event)
    const parsed = parseSessionInput(await readBody<SessionInput>(event))

    return useDrizzle().transaction((tx) => {
        const session = tx
            .insert(tables.sessions)
            .values({ name: parsed.name, userId })
            .returning()
            .get()

        writeSessionEntries(tx, userId, session.id, parsed.entries)
        return session
    })
})
