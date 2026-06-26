# Domain glossary

The shared vocabulary for kilorep. Names here are load-bearing: code, tests, and
architecture reviews should use these exact terms rather than inventing synonyms.

## Core nouns

- **Exercise** — a movement in the user's catalog (e.g. "Bench Press"), with
  equipment, type, and targeted **muscles**. Per-user; never shared across users.
  The 20-muscle vocabulary rolls up into six **muscle groups** (the filter
  regions) in `shared/utils/muscles.ts` (`MUSCLE_GROUPS`, `groupsOf`).
- **Session** (a.k.a. **template**) — a reusable plan ("Push Day"): an ordered
  list of **entries**, each prescribing exercises and per-set rep targets. A set
  in a template carries only a rep target (`null` = an **open target**, decided
  at workout time). Has no logged load.
- **Workout** — one performed instance, usually copied from a session. Its sets
  carry the logged **load** (`weight`) on top of reps. A workout keeps a
  `sessionId` link to the template it followed (nullable for an ad-hoc log).
- **Entry** — one row of a session/workout tree. An entry with more than one
  exercise is a **superset**.
- **Set** — the leaf of the tree. Prescribed (template) vs logged (workout).
- **Draft** — the client-side, in-progress edit tree the editor pages bind to,
  before it is serialized to an API payload. The model (types, factories,
  hydration, serialization, mutation rules) lives in two sibling modules —
  `app/utils/workoutDraft.ts` and `app/utils/sessionDraft.ts` — not in the
  pages. They diverge on purpose: a workout "add set" copies the last set
  (carrying the load forward) and removing the last exercise prunes its entry;
  a session set is blank and rep-only. The pages keep thin adapters bound to
  the template; the rules are unit-tested in `tests/workoutDraft.test.ts`.

## Tree shape

Both sessions and workouts are the same nested shape:
`row → entries[] → exercises[] → sets[]`, each level ordered by a stored
`position`. Reads pull four flat queries and **stitch** them in memory rather
than fanning out a join.

## Write operations (deepened modules)

The persistence modules own their own transaction — transports (REST routes, MCP
tools) pass domain values, never a `DbTransaction`. The interface is the seam
tests call.

- `server/utils/workouts.ts`
    - `createWorkout(userId, parsed, sessionId?, defaultName?)` — log a workout
      after the fact from a parsed payload.
    - `copySessionToWorkout(userId, sessionId)` — start a workout from a template,
      seeding open targets from the lifter's **last logged reps**.
    - `saveWorkout(userId, id, parsed)` — replace a workout's row + whole tree.
    - `writeWorkoutEntries` / `lastLoggedReps` are internal helpers of these.
- `server/utils/sessions.ts`
    - `createSessionTree(userId, parsed, tx?)` — owns its transaction unless the
      caller passes one. The optional `tx` exists for a single justified atomic
      composition: `POST /api/workouts/:id/to-session` create-mode creates the new
      template **and** re-points the workout in one transaction.
    - `replaceSessionTree(userId, id, parsed)` — rename + replace the whole tree.

## Template sync

`server/utils/template-sync.ts` (pure, unit-tested) compares a workout's tree to
its template. A change is **structural** iff its kind isn't `reps`; the sync-back
strip lights only on structural divergence, so editing logged reps never offers
to rewrite the plan.

## Test surfaces

- **Pure unit tests** (`bun run test:unit`, `bun test`): pure functions with no
  Nitro/DB dependency — `shared/utils/stats.ts`, `server/utils/template-sync.ts`,
  and the editor draft models (`tests/workoutDraft.test.ts`).
- **Domain tests** (`bun run test:domain`, vitest): the DB-touching write modules
  against an **in-memory** migrated SQLite (`tests/server/`). The modules keep
  Nitro's auto-imports; `tests/server/setup.ts` re-exposes those names on
  `globalThis` and points `useDrizzle()` at the in-memory db. Runs in vitest's
  `node` environment, not `nuxt` — @nuxt/test-utils' nuxt env resolves _app_
  auto-imports, not _Nitro server_ ones, so server domain tests need the globals
  shim instead. The `nuxt` environment stays available for future app/component
  tests.
- **Contract** (`bun run test:contract`): every REST response validated against
  `openapi/kilorep.json` over real HTTP, plus a drift gate.
- **Isolation** (`bun run test:isolation`): the multi-user `userId`-scoping
  backstop against an auth-mode instance.
