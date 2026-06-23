// Makes the Nitro server modules runnable under vitest without changing them.
//
// In production Nitro auto-imports `useDrizzle`, `tables`, `badRequest`,
// `groupBy`, the drizzle operators and the cross-module domain helpers into
// every server file at build time. vitest does not, so the modules reference
// those names as free identifiers. We re-expose the real implementations on
// `globalThis` under the same names — a free-identifier scope miss falls
// through to globalThis, so the modules resolve them exactly as they would in
// Nitro. Then we point `useDrizzle()` at a fresh in-memory database with the
// real migrations applied, making the domain interface the test surface.
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as h3 from 'h3'

import * as schema from '../../server/database/schema'
import * as collections from '../../server/utils/collections'
import * as drizzleUtils from '../../server/utils/drizzle'
import * as exercises from '../../server/utils/exercises'
import * as http from '../../server/utils/http'
import * as sessions from '../../server/utils/sessions'
import * as workouts from '../../server/utils/workouts'

Object.assign(
    globalThis,
    h3, // createError, behind the http throwers
    drizzleUtils, // useDrizzle, tables, eq/and/inArray/asc/desc/sql/isNotNull …
    http, // badRequest, notFound, conflict …
    collections, // groupBy
    sessions, // parseRepsTarget, writeSessionEntries …
    exercises, // assertExercisesOwned, createExercise …
    workouts, // loadWorkoutTrees, writeWorkoutEntries …
)

const sqlite = new Database(':memory:')
// Foreign keys off during the rebuild, on for the tests — the same dance the
// migrate plugin does so table-recreation migrations don't trip enforcement.
sqlite.pragma('foreign_keys = OFF')
migrate(drizzle(sqlite), { migrationsFolder: 'server/database/migrations' })
sqlite.pragma('foreign_keys = ON')

// useDrizzle() returns globalThis.workoutDb when set, so it never opens the
// file-backed database the production helper would.
;(globalThis as Record<string, unknown>).workoutDb = drizzle(sqlite, { schema })
