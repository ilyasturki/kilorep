import { createHash, randomBytes } from 'node:crypto'

import type { ApiTokenInfo } from '../database/schema'
import { toDateInput } from '~~/shared/utils/date'

/** Hard ceiling per user — far above real use, just bounds forgetful re-minting. */
export const API_TOKEN_LIMIT = 10

export const LABEL_MAX = 60

/** The one label rule, shared by create and rename: trimmed and capped. */
export function normalizeLabel(raw: unknown): string {
    return typeof raw === 'string' ? raw.trim().slice(0, LABEL_MAX) : ''
}

// How much of the cleartext the list may show. 5 random base64url chars
// (~30 bits) is plenty to tell tokens apart and useless to an attacker.
const PREFIX_LENGTH = 8

// SHA-256 is enough at rest: tokens are 32 random bytes, far beyond
// brute-force range, so a slow hash would buy nothing.
function hashApiToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
}

const tokenInfo = {
    id: tables.apiTokens.id,
    label: tables.apiTokens.label,
    tokenPrefix: tables.apiTokens.tokenPrefix,
    createdAt: tables.apiTokens.createdAt,
    lastUsedAt: tables.apiTokens.lastUsedAt,
}

export function listApiTokens(userId: number): ApiTokenInfo[] {
    return useDrizzle()
        .select(tokenInfo)
        .from(tables.apiTokens)
        .where(eq(tables.apiTokens.userId, userId))
        .orderBy(asc(tables.apiTokens.id))
        .all()
}

/**
 * Mints an MCP bearer token, storing only its hash. The cleartext is returned
 * exactly once — afterwards the row is identified by label and prefix alone.
 */
export function createApiToken(
    userId: number,
    label?: unknown,
): { token: string; record: ApiTokenInfo } {
    const count = listApiTokens(userId).length
    if (count >= API_TOKEN_LIMIT) {
        badRequest(
            `Token limit reached (${API_TOKEN_LIMIT}) — delete one first`,
        )
    }

    const token = `kr_${randomBytes(32).toString('base64url')}`
    // The settings page sends its own date-stamped fallback in the user's
    // timezone and locale; this one only covers direct API callers, so the
    // neutral YYYY-MM-DD form beats guessing either.
    const fallback = `Token · ${toDateInput(new Date())}`
    const record = useDrizzle()
        .insert(tables.apiTokens)
        .values({
            userId,
            label: normalizeLabel(label) || fallback,
            tokenHash: hashApiToken(token),
            tokenPrefix: token.slice(0, PREFIX_LENGTH),
        })
        .returning(tokenInfo)
        .get()
    return { token, record }
}

/**
 * Renames a token — the label is the user's only handle on which client holds
 * it, so unlike creation an empty label is rejected rather than defaulted:
 * renaming to nothing would only erase information.
 */
export function renameApiToken(
    userId: number,
    id: number,
    label: unknown,
): ApiTokenInfo | undefined {
    const clean = normalizeLabel(label)
    if (!clean) badRequest('Label is required')
    return useDrizzle()
        .update(tables.apiTokens)
        .set({ label: clean })
        .where(
            and(
                eq(tables.apiTokens.id, id),
                eq(tables.apiTokens.userId, userId),
            ),
        )
        .returning(tokenInfo)
        .get()
}

/** Revokes a token; any client still holding it gets a 401 on its next call. */
export function deleteApiToken(userId: number, id: number): boolean {
    const result = useDrizzle()
        .delete(tables.apiTokens)
        .where(
            and(
                eq(tables.apiTokens.id, id),
                eq(tables.apiTokens.userId, userId),
            ),
        )
        .run()
    return result.changes > 0
}

export function findUserIdByApiToken(token: string): number | undefined {
    const row = useDrizzle()
        .select({ id: tables.apiTokens.id, userId: tables.apiTokens.userId })
        .from(tables.apiTokens)
        .where(eq(tables.apiTokens.tokenHash, hashApiToken(token)))
        .get()
    if (!row) return undefined
    useDrizzle()
        .update(tables.apiTokens)
        .set({ lastUsedAt: new Date() })
        .where(eq(tables.apiTokens.id, row.id))
        .run()
    return row.userId
}
