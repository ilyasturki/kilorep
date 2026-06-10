import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

import * as schema from '../database/schema'

export {
    and,
    asc,
    desc,
    eq,
    gt,
    gte,
    inArray,
    lt,
    lte,
    or,
    sql,
} from 'drizzle-orm'

export const tables = schema

export const DB_FILE_NAME = process.env.DB_FILE_NAME ?? '.data/workout.db'

type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>

/** The handle passed to `db.transaction(tx => …)`, shared by the tree writers. */
export type DbTransaction = Parameters<
    Parameters<DrizzleDB['transaction']>[0]
>[0]

// Reuse the connection across HMR reloads in dev so we don't leak file handles.
const globalForDb = globalThis as typeof globalThis & {
    workoutDb?: DrizzleDB
}

function createDatabase(): DrizzleDB {
    mkdirSync(dirname(DB_FILE_NAME), { recursive: true })
    const sqlite = new Database(DB_FILE_NAME)
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    return drizzle(sqlite, { schema })
}

export function useDrizzle(): DrizzleDB {
    if (!globalForDb.workoutDb) {
        globalForDb.workoutDb = createDatabase()
    }
    return globalForDb.workoutDb
}
