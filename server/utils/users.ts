import type { User } from '../database/schema'
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

type GoogleProfile = {
    sub: string
    email?: string
    name?: string
    picture?: string
}

/**
 * Resolves a Google sign-in to an account. Identity is the stable `sub`
 * claim, never the email — Google lets users change that. First sign-in
 * creates the account and seeds its own copy of the exercise catalog;
 * later sign-ins refresh the profile fields.
 */
export function findOrCreateGoogleUser(profile: GoogleProfile): User {
    const db = useDrizzle()
    const fields = {
        email: profile.email ?? null,
        name: profile.name ?? null,
        avatarUrl: profile.picture ?? null,
    }

    const existing = db
        .select()
        .from(tables.users)
        .where(
            and(
                eq(tables.users.provider, 'google'),
                eq(tables.users.providerAccountId, profile.sub),
            ),
        )
        .get()
    if (existing) {
        return db
            .update(tables.users)
            .set(fields)
            .where(eq(tables.users.id, existing.id))
            .returning()
            .get()
    }

    const user = db
        .insert(tables.users)
        .values({
            provider: 'google',
            providerAccountId: profile.sub,
            ...fields,
        })
        .returning()
        .get()
    syncUserCatalog(user.id, 0)
    return user
}

export function userExists(id: number): boolean {
    return (
        useDrizzle()
            .select({ id: tables.users.id })
            .from(tables.users)
            .where(eq(tables.users.id, id))
            .get() !== undefined
    )
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
                EXERCISE_CATALOG.slice(cursor).map((entry) => ({
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

/** The user's saved locale, or null when they follow the device. */
export function getUserLocale(userId: number): string | null {
    return (
        useDrizzle()
            .select({ locale: tables.users.locale })
            .from(tables.users)
            .where(eq(tables.users.id, userId))
            .get()?.locale ?? null
    )
}

/** Pin (or, with null, clear) the user's number/date locale. */
export function setUserLocale(userId: number, locale: string | null): void {
    useDrizzle()
        .update(tables.users)
        .set({ locale })
        .where(eq(tables.users.id, userId))
        .run()
}
