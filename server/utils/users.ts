import { EXERCISE_CATALOG } from '../database/exercise-catalog'

// Memoised per process; the row itself is permanent once created.
let localUserId: number | null = null

/**
 * The implicit account all data belongs to when the app runs without
 * authentication configured. Created on first use so a fresh self-hosted
 * database works with no setup.
 */
export function ensureLocalUserId(): number {
    if (localUserId != null) return localUserId
    const db = useDrizzle()
    const user =
        db
            .select({ id: tables.users.id })
            .from(tables.users)
            .where(eq(tables.users.provider, 'local'))
            .get()
        ?? db
            .insert(tables.users)
            .values({ provider: 'local', providerAccountId: 'default' })
            .returning({ id: tables.users.id })
            .get()
    localUserId = user.id
    return user.id
}

/**
 * Offers a user the catalog entries appended since their cursor, then moves
 * the cursor — deleting a default exercise sticks, because entries already
 * offered are never re-applied. A user-created exercise may share a name with
 * a catalog entry appended later; the user's version wins.
 */
export function syncUserCatalog(userId: number, cursor: number): void {
    if (cursor >= EXERCISE_CATALOG.length) return

    useDrizzle().transaction((tx) => {
        tx.insert(tables.exercises)
            .values(
                EXERCISE_CATALOG.slice(Math.max(0, cursor)).map((entry) => ({
                    ...entry,
                    userId,
                })),
            )
            .onConflictDoNothing({
                target: [tables.exercises.userId, tables.exercises.name],
            })
            .run()
        tx.update(tables.users)
            .set({ catalogCursor: EXERCISE_CATALOG.length })
            .where(eq(tables.users.id, userId))
            .run()
    })
}
