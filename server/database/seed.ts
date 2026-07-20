/**
 * Local-dev seed: one command that fills the dev database with a realistic
 * multi-user training history. Never run any of this in prod.
 *
 *  - The rich account is your real Google account (matched by email, so the
 *    normal dev-server sign-in shows the data): three Push/Pull/Legs
 *    templates, ~6 months of workouts with progressive overload and two
 *    deload dips, ~4 months of weigh-ins, two custom exercises, one recent
 *    workout that diverged from its template (exercises the sync-back strip)
 *    and one workout still in progress.
 *  - Two fake accounts (fake `seed-*` Google subs on the reserved
 *    @example.test domain) carry a few weeks of their own data, so the
 *    database reads as genuinely multi-user and cross-account isolation
 *    stays observable in dev.
 *
 * Destructive for seeded accounts only: each run wipes and rebuilds their
 * workouts, templates, weigh-ins and seed-created custom exercises. The users
 * row itself (identity, locale, API tokens) and every other account are never
 * touched.
 *
 * Raw SQL on purpose: importing the Drizzle schema would pull in its
 * extensionless `.ts` imports, which Node's type-stripping can't resolve
 * outside the Nuxt/Nitro bundler. Runs under Node
 * (`node server/database/seed.ts`) against the same better-sqlite3 file the
 * dev server has open — WAL keeps the two processes out of each other's way,
 * and the server needs no restart to show the data.
 */
import { existsSync } from 'node:fs'
import Database from 'better-sqlite3'

const RICH_EMAIL = process.env.SEED_RICH_EMAIL ?? 'turki.ilyass@gmail.com'
const databasePath = process.env.DB_FILE_NAME ?? '.data/workout.db'

if (!existsSync(databasePath)) {
    console.error(
        `No database at ${databasePath} — start the dev server once so migrations create it, then re-run.`,
    )
    process.exit(1)
}

const db = new Database(databasePath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
db.pragma('busy_timeout = 5000')

if (
    !db
        .prepare(
            `select 1 from sqlite_master where type = 'table' and name = 'users'`,
        )
        .get()
) {
    console.error(
        `${databasePath} has no tables — start the dev server once so migrations run, then re-run.`,
    )
    process.exit(1)
}

// The rich dataset lands on the account you actually sign into. Falling back
// to the implicit local row makes the same script work against a solo-mode
// database (DB_FILE_NAME=.data/workout-solo.db).
const richUser =
    db
        .prepare<[string], { id: number; catalogCursor: number }>(
            `select id, catalog_cursor as catalogCursor from users
             where provider = 'google' and email = ?`,
        )
        .get(RICH_EMAIL)
    ?? db
        .prepare<[], { id: number; catalogCursor: number }>(
            `select id, catalog_cursor as catalogCursor from users where provider = 'local'`,
        )
        .get()
if (!richUser) {
    console.error(
        `No account for ${RICH_EMAIL} (and no local account) in ${databasePath} — sign in once on the dev server, then re-run.`,
    )
    process.exit(1)
}

// Deterministic content: only the date anchor moves with the clock, so
// re-running refreshes dates without reshuffling the whole history.
let prngState = 0x6b696c6f
function rnd(): number {
    prngState = (prngState + 0x6d2b79f5) | 0
    let t = Math.imul(prngState ^ (prngState >>> 15), 1 | prngState)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const startOfToday = new Date()
startOfToday.setHours(0, 0, 0, 0)
const todaySec = Math.floor(startOfToday.getTime() / 1000)
/** Unix seconds at local `hour:minute`, `daysBack` days ago. */
const at = (daysBack: number, hour: number, minute = 0) =>
    todaySec - daysBack * 86_400 + hour * 3600 + minute * 60
/** Local 'YYYY-MM-DD' `daysBack` days ago (bodyweight dates are day-precise). */
function dayISO(daysBack: number): string {
    const d = new Date(startOfToday.getTime() - daysBack * 86_400_000)
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${d.getFullYear()}-${month}-${day}`
}
const weekday = (daysBack: number) =>
    new Date(startOfToday.getTime() - daysBack * 86_400_000).getDay()

type Intensity = 'high' | 'medium' | 'low'
interface MuscleTarget {
    muscle: string
    intensity: Intensity
}
interface ExerciseDef {
    name: string
    equipment: 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight'
    type: 'compound' | 'isolation'
    source: 'catalog' | 'custom'
    muscles: MuscleTarget[]
    aliases?: string[]
}
const T = (muscle: string, intensity: Intensity = 'high'): MuscleTarget => ({
    muscle,
    intensity,
})

// The movements the seeded templates reference. Catalog entries are copied
// verbatim from exercise-catalog.ts so a re-insert (only happens if the
// account deleted the default) matches what shipped; the two `custom` entries
// exist only through this seed and are wiped and rebuilt on every run.
const EXERCISE_DEFS: ExerciseDef[] = [
    {
        name: 'Barbell Bench Press',
        aliases: ['Flat Bench Press'],
        equipment: 'barbell',
        type: 'compound',
        source: 'catalog',
        muscles: [
            T('chest'),
            T('front delts', 'medium'),
            T('triceps', 'medium'),
        ],
    },
    {
        name: 'Overhead Press',
        aliases: ['Military Press', 'Barbell Shoulder Press'],
        equipment: 'barbell',
        type: 'compound',
        source: 'catalog',
        muscles: [
            T('front delts'),
            T('side delts', 'medium'),
            T('triceps', 'medium'),
        ],
    },
    {
        name: 'Incline Dumbbell Bench Press',
        equipment: 'dumbbell',
        type: 'compound',
        source: 'catalog',
        muscles: [
            T('upper chest'),
            T('front delts', 'medium'),
            T('triceps', 'medium'),
        ],
    },
    {
        name: 'Cable Lateral Raise',
        equipment: 'cable',
        type: 'isolation',
        source: 'catalog',
        muscles: [T('side delts')],
    },
    {
        name: 'Cable Triceps Pushdown',
        aliases: ['Triceps Pressdown', 'Rope Pushdown'],
        equipment: 'cable',
        type: 'isolation',
        source: 'catalog',
        muscles: [T('triceps')],
    },
    {
        name: 'Deadlift',
        aliases: ['Conventional Deadlift'],
        equipment: 'barbell',
        type: 'compound',
        source: 'catalog',
        muscles: [
            T('lower back'),
            T('glutes'),
            T('hamstrings'),
            T('traps', 'medium'),
            T('lats', 'medium'),
        ],
    },
    {
        name: 'Pull-Up',
        equipment: 'bodyweight',
        type: 'compound',
        source: 'catalog',
        muscles: [T('lats'), T('rhomboids', 'medium'), T('biceps', 'medium')],
    },
    {
        name: 'Seated Cable Row',
        equipment: 'cable',
        type: 'compound',
        source: 'catalog',
        muscles: [T('lats'), T('rhomboids'), T('biceps', 'medium')],
    },
    {
        name: 'Face Pull',
        equipment: 'cable',
        type: 'isolation',
        source: 'catalog',
        muscles: [T('rear delts'), T('traps', 'medium')],
    },
    {
        name: 'Hammer Curl',
        aliases: ['Neutral-Grip Curl'],
        equipment: 'dumbbell',
        type: 'isolation',
        source: 'catalog',
        muscles: [
            T('brachialis'),
            T('biceps', 'medium'),
            T('forearms', 'medium'),
        ],
    },
    {
        name: 'Back Squat',
        aliases: ['Barbell Squat'],
        equipment: 'barbell',
        type: 'compound',
        source: 'catalog',
        muscles: [
            T('quads'),
            T('glutes'),
            T('hamstrings', 'medium'),
            T('lower back', 'medium'),
        ],
    },
    {
        name: 'Romanian Deadlift',
        equipment: 'barbell',
        type: 'compound',
        source: 'catalog',
        muscles: [T('hamstrings'), T('glutes'), T('lower back', 'medium')],
    },
    {
        name: 'Leg Press',
        equipment: 'machine',
        type: 'compound',
        source: 'catalog',
        muscles: [T('quads'), T('glutes'), T('hamstrings', 'medium')],
    },
    {
        name: 'Seated Leg Curl',
        aliases: ['Seated Hamstring Curl'],
        equipment: 'machine',
        type: 'isolation',
        source: 'catalog',
        muscles: [T('hamstrings')],
    },
    {
        name: 'Standing Calf Raise',
        equipment: 'machine',
        type: 'isolation',
        source: 'catalog',
        muscles: [T('calves')],
    },
    {
        name: 'Landmine Press',
        equipment: 'barbell',
        type: 'compound',
        source: 'custom',
        muscles: [
            T('front delts'),
            T('upper chest', 'medium'),
            T('triceps', 'medium'),
        ],
    },
    {
        name: 'Nordic Curl',
        aliases: ['Nordic Hamstring Curl'],
        equipment: 'bodyweight',
        type: 'isolation',
        source: 'custom',
        muscles: [T('hamstrings')],
    },
]
const CUSTOM_NAMES = EXERCISE_DEFS.filter((d) => d.source === 'custom').map(
    (d) => d.name,
)

/** One template entry: one exercise, or several rotated as a superset. */
type EntryDef = [name: string, targets: (number | null)[]][]
interface TemplateDef {
    name: string
    entries: EntryDef[]
}

const RICH_TEMPLATES: TemplateDef[] = [
    {
        name: 'Push Day',
        entries: [
            [['Barbell Bench Press', [8, 8, 8, 8]]],
            [['Overhead Press', [8, 8, 8]]],
            [['Incline Dumbbell Bench Press', [10, 10, 10]]],
            [
                ['Cable Lateral Raise', [12, 12, 12]],
                // Open target on the last set: reps decided on the day.
                ['Cable Triceps Pushdown', [12, 12, null]],
            ],
        ],
    },
    {
        name: 'Pull Day',
        entries: [
            [['Deadlift', [5, 5, 5]]],
            [['Pull-Up', [8, 8, 8]]],
            [['Seated Cable Row', [10, 10, 10]]],
            [
                ['Face Pull', [15, 15, 15]],
                ['Hammer Curl', [10, 10, 10]],
            ],
        ],
    },
    {
        name: 'Leg Day',
        entries: [
            [['Back Squat', [6, 6, 6, 6]]],
            [['Romanian Deadlift', [8, 8, 8]]],
            [['Leg Press', [10, 10, 10]]],
            [['Seated Leg Curl', [12, 12, 12]]],
            [['Nordic Curl', [8, 8]]],
            [['Standing Calf Raise', [15, 15, 15]]],
        ],
    },
]

// Working weights in kg: `start` + `gain`·week over ~6 months lands on
// plausible numbers; `step` is the plate/stack increment the gym allows.
const PROGRESSION: Record<
    string,
    { start: number; gain: number; step: number } | null
> = {
    'Barbell Bench Press': { start: 60, gain: 0.75, step: 2.5 },
    'Overhead Press': { start: 40, gain: 0.5, step: 2.5 },
    'Incline Dumbbell Bench Press': { start: 22, gain: 0.4, step: 2 },
    'Cable Lateral Raise': { start: 10, gain: 0.3, step: 2.5 },
    'Cable Triceps Pushdown': { start: 20, gain: 0.4, step: 2.5 },
    Deadlift: { start: 100, gain: 1.5, step: 2.5 },
    // Added weight on a belt — early weeks stay at bodyweight (null).
    'Pull-Up': { start: 0, gain: 0.4, step: 2.5 },
    'Seated Cable Row': { start: 50, gain: 0.75, step: 2.5 },
    'Face Pull': { start: 15, gain: 0.2, step: 2.5 },
    'Hammer Curl': { start: 12, gain: 0.2, step: 2 },
    'Back Squat': { start: 80, gain: 1.25, step: 2.5 },
    'Romanian Deadlift': { start: 70, gain: 1, step: 2.5 },
    'Leg Press': { start: 120, gain: 2, step: 5 },
    'Seated Leg Curl': { start: 35, gain: 0.5, step: 2.5 },
    'Standing Calf Raise': { start: 40, gain: 0.5, step: 2.5 },
    'Nordic Curl': null,
    'Landmine Press': { start: 30, gain: 0.5, step: 2.5 },
}

const RICH_WEEKS = 26
const DELOAD_WEEKS = new Set([13, 21])

function weightFor(name: string, week: number, scale = 1): number | null {
    const p = PROGRESSION[name]
    if (!p) return null
    // Flat linear progress reads fake: deload dips and the occasional off day
    // put believable noise in the charts.
    const deload = DELOAD_WEEKS.has(week) ? 0.85 : 1
    let w = (p.start + p.gain * week) * deload * scale
    if (rnd() < 0.2) w -= p.step
    w = Math.round(w / p.step) * p.step
    return w <= 0 ? null : w
}

function repsFor(target: number | null, setIndex: number, setCount: number) {
    const base = target ?? 12
    if (setIndex === setCount - 1 && rnd() < 0.4)
        return Math.max(1, base - 1 - Math.floor(rnd() * 2))
    if (rnd() < 0.12) return base + 1
    return base
}

// ── Prepared statements ──────────────────────────────────────────────────────

const insExercise = db.prepare(
    `insert into exercises (user_id, name, equipment, type, source, muscles, aliases)
     values (@userId, @name, @equipment, @type, @source, @muscles, @aliases)
     on conflict(user_id, name) do nothing`,
)
const insSession = db.prepare(
    `insert into sessions (user_id, name, position, created_at) values (?, ?, ?, ?)`,
)
const insSessionEntry = db.prepare(
    `insert into session_entries (session_id, position) values (?, ?)`,
)
const insSessionExercise = db.prepare(
    `insert into session_exercises (entry_id, exercise_id, position) values (?, ?, ?)`,
)
const insSet = db.prepare(
    `insert into sets (session_exercise_id, reps, position) values (?, ?, ?)`,
)
const insWorkout = db.prepare(
    `insert into workouts (user_id, session_id, name, started_at, completed) values (?, ?, ?, ?, ?)`,
)
const insWorkoutEntry = db.prepare(
    `insert into workout_entries (workout_id, position) values (?, ?)`,
)
const insWorkoutExercise = db.prepare(
    `insert into workout_exercises (entry_id, exercise_id, position) values (?, ?, ?)`,
)
const insWorkoutSet = db.prepare(
    `insert into workout_sets (workout_exercise_id, reps, weight, position) values (?, ?, ?, ?)`,
)
const insBodyweight = db.prepare(
    `insert into bodyweight (user_id, date, weight, created_at) values (?, ?, ?, ?)`,
)

// ── Builders ─────────────────────────────────────────────────────────────────

/** Bottom-up deletes so nothing depends on FK cascade behaviour. */
function wipeUserData(userId: number) {
    db.prepare(
        `delete from workout_sets where workout_exercise_id in (
            select we.id from workout_exercises we
            join workout_entries en on en.id = we.entry_id
            join workouts w on w.id = en.workout_id
            where w.user_id = ?)`,
    ).run(userId)
    db.prepare(
        `delete from workout_exercises where entry_id in (
            select en.id from workout_entries en
            join workouts w on w.id = en.workout_id
            where w.user_id = ?)`,
    ).run(userId)
    db.prepare(
        `delete from workout_entries where workout_id in (
            select id from workouts where user_id = ?)`,
    ).run(userId)
    db.prepare(`delete from workouts where user_id = ?`).run(userId)
    db.prepare(
        `delete from sets where session_exercise_id in (
            select se.id from session_exercises se
            join session_entries en on en.id = se.entry_id
            join sessions s on s.id = en.session_id
            where s.user_id = ?)`,
    ).run(userId)
    db.prepare(
        `delete from session_exercises where entry_id in (
            select en.id from session_entries en
            join sessions s on s.id = en.session_id
            where s.user_id = ?)`,
    ).run(userId)
    db.prepare(
        `delete from session_entries where session_id in (
            select id from sessions where user_id = ?)`,
    ).run(userId)
    db.prepare(`delete from sessions where user_id = ?`).run(userId)
    db.prepare(`delete from bodyweight where user_id = ?`).run(userId)
}

function ensureExercises(userId: number, defs: ExerciseDef[]) {
    for (const def of defs) {
        insExercise.run({
            userId,
            name: def.name,
            equipment: def.equipment,
            type: def.type,
            source: def.source,
            muscles: JSON.stringify(def.muscles),
            aliases: JSON.stringify(def.aliases ?? []),
        })
    }
}

function exerciseIdsByName(userId: number): Map<string, number> {
    const rows = db
        .prepare<[number], { id: number; name: string }>(
            `select id, name from exercises where user_id = ?`,
        )
        .all(userId)
    return new Map(rows.map((r) => [r.name, r.id]))
}

interface BuiltTemplate {
    sessionId: number
    def: TemplateDef
}

function buildTemplate(
    userId: number,
    def: TemplateDef,
    position: number,
    createdAt: number,
    ids: Map<string, number>,
): BuiltTemplate {
    const sessionId = Number(
        insSession.run(userId, def.name, position, createdAt).lastInsertRowid,
    )
    def.entries.forEach((entry, entryIndex) => {
        const entryId = Number(
            insSessionEntry.run(sessionId, entryIndex).lastInsertRowid,
        )
        entry.forEach(([name, targets], exIndex) => {
            const exerciseId = ids.get(name)
            if (!exerciseId) throw new Error(`missing exercise: ${name}`)
            const sessionExerciseId = Number(
                insSessionExercise.run(entryId, exerciseId, exIndex)
                    .lastInsertRowid,
            )
            targets.forEach((reps, setIndex) => {
                insSet.run(sessionExerciseId, reps, setIndex)
            })
        })
    })
    return { sessionId, def }
}

interface LogOptions {
    completed?: boolean
    scale?: number
    /** Sets past this global index stay unentered — an in-progress workout. */
    loggedUpTo?: number
    /** Appended entries, diverging the workout from its template. */
    extra?: { name: string; sets: { reps: number; weight: number | null }[] }[]
}

let loggedSetCount = 0

function logWorkout(
    userId: number,
    tpl: BuiltTemplate,
    startedAt: number,
    week: number,
    ids: Map<string, number>,
    opts: LogOptions = {},
) {
    const { completed = true, scale = 1, loggedUpTo = Infinity } = opts
    const workoutId = Number(
        insWorkout.run(
            userId,
            tpl.sessionId,
            tpl.def.name,
            startedAt,
            completed ? 1 : 0,
        ).lastInsertRowid,
    )
    let globalSet = 0
    tpl.def.entries.forEach((entry, entryIndex) => {
        const entryId = Number(
            insWorkoutEntry.run(workoutId, entryIndex).lastInsertRowid,
        )
        entry.forEach(([name, targets], exIndex) => {
            const workoutExerciseId = Number(
                insWorkoutExercise.run(entryId, ids.get(name)!, exIndex)
                    .lastInsertRowid,
            )
            const weight = weightFor(name, week, scale)
            targets.forEach((target, setIndex) => {
                const entered = globalSet++ < loggedUpTo
                // Unentered sets mirror copySessionToWorkout: reps pre-seeded
                // from the target, weight left blank for the lifter.
                insWorkoutSet.run(
                    workoutExerciseId,
                    entered ?
                        repsFor(target, setIndex, targets.length)
                    :   target,
                    entered ? weight : null,
                    setIndex,
                )
                if (entered) loggedSetCount++
            })
        })
    })
    for (const [i, extra] of (opts.extra ?? []).entries()) {
        const entryId = Number(
            insWorkoutEntry.run(workoutId, tpl.def.entries.length + i)
                .lastInsertRowid,
        )
        const workoutExerciseId = Number(
            insWorkoutExercise.run(entryId, ids.get(extra.name)!, 0)
                .lastInsertRowid,
        )
        extra.sets.forEach((set, setIndex) => {
            insWorkoutSet.run(workoutExerciseId, set.reps, set.weight, setIndex)
            loggedSetCount++
        })
    }
}

// ── Fake accounts ────────────────────────────────────────────────────────────

interface FakeAccount {
    sub: string
    email: string
    name: string
    weeks: number
    /** getDay() numbers of the training days. */
    days: number[]
    scale: number
    bodyweight: { start: number; drift: number }
    template: TemplateDef
}

// Reserved @example.test domain (RFC 6761): clearly fake, never deliverable.
const FAKE_ACCOUNTS: FakeAccount[] = [
    {
        sub: 'seed-alex',
        email: 'alex.rivera@example.test',
        name: 'Alex Rivera',
        weeks: 5,
        days: [1, 4],
        scale: 1,
        bodyweight: { start: 82.4, drift: 0.4 },
        template: {
            name: 'Full Body',
            entries: [
                [['Back Squat', [5, 5, 5]]],
                [['Barbell Bench Press', [8, 8, 8]]],
                [['Seated Cable Row', [10, 10, 10]]],
            ],
        },
    },
    {
        sub: 'seed-mia',
        email: 'mia.chen@example.test',
        name: 'Mia Chen',
        weeks: 4,
        days: [2, 6],
        scale: 0.65,
        bodyweight: { start: 63.8, drift: -0.5 },
        template: {
            name: 'Upper Body',
            entries: [
                [['Pull-Up', [6, 6, 6]]],
                [['Incline Dumbbell Bench Press', [10, 10, 10]]],
                [
                    ['Face Pull', [15, 15]],
                    ['Hammer Curl', [10, 10]],
                ],
            ],
        },
    },
]

const upsertFakeUser = db.prepare<
    [{ sub: string; email: string; name: string; cursor: number }],
    { id: number }
>(
    `insert into users (provider, provider_account_id, email, name, catalog_cursor)
     values ('google', @sub, @email, @name, @cursor)
     on conflict(provider, provider_account_id) do update
         set email = excluded.email, name = excluded.name,
             catalog_cursor = excluded.catalog_cursor
     returning id`,
)
const cloneCatalog = db.prepare(
    `insert into exercises (user_id, name, equipment, type, source, muscles, aliases)
     select @to, name, equipment, type, source, muscles, aliases
     from exercises where user_id = @from and source = 'catalog'`,
)

// ── Build everything ─────────────────────────────────────────────────────────

interface AccountSummary {
    email: string
    templates: number
    workouts: number
    sets: number
    weighIns: number
}

const seed = db.transaction((): AccountSummary[] => {
    const summaries: AccountSummary[] = []

    // -- Rich account ---------------------------------------------------------
    wipeUserData(richUser.id)
    // Custom exercises are seed-owned: drop and re-create so edits here stick.
    db.prepare(
        `delete from exercises where user_id = ?
         and source = 'custom' and name in (${CUSTOM_NAMES.map(() => '?').join(', ')})`,
    ).run(richUser.id, ...CUSTOM_NAMES)
    ensureExercises(richUser.id, EXERCISE_DEFS)
    const richIds = exerciseIdsByName(richUser.id)

    const templateCreatedAt = at(RICH_WEEKS * 7 + 4, 19, 30)
    const templates = RICH_TEMPLATES.map((def, i) =>
        buildTemplate(richUser.id, def, i, templateCreatedAt, richIds),
    )

    // Mon/Wed/Fri, an occasional Saturday, an occasional life-got-in-the-way
    // skip; the P/P/L rotation carries across weeks.
    const plan: { daysBack: number; week: number; tplIndex: number }[] = []
    let rotation = 0
    for (let daysBack = RICH_WEEKS * 7; daysBack >= 1; daysBack--) {
        const day = weekday(daysBack)
        const trains =
            [1, 3, 5].includes(day) ? rnd() > 0.08 : day === 6 && rnd() < 0.3
        if (!trains) continue
        plan.push({
            daysBack,
            week: Math.floor((RICH_WEEKS * 7 - daysBack) / 7),
            tplIndex: rotation++ % templates.length,
        })
    }
    loggedSetCount = 0
    for (const [i, p] of plan.entries()) {
        const tpl = templates[p.tplIndex]
        if (!tpl) continue
        const startedAt = at(
            p.daysBack,
            17 + Math.floor(rnd() * 3),
            Math.floor(rnd() * 60),
        )
        // The most recent completed workout drifts from its template (an added
        // custom exercise) so the sync-back strip has something to show.
        const diverged = i === plan.length - 1
        logWorkout(richUser.id, tpl, startedAt, p.week, richIds, {
            extra:
                diverged ?
                    [
                        {
                            name: 'Landmine Press',
                            sets: [10, 10, 10].map((reps) => ({
                                reps,
                                weight: weightFor('Landmine Press', p.week),
                            })),
                        },
                    ]
                :   undefined,
        })
    }
    // Still under the bar right now: started an hour ago, first sets logged,
    // the rest waiting exactly as copySessionToWorkout leaves them.
    const nextTpl = templates[rotation % templates.length]
    if (nextTpl) {
        logWorkout(
            richUser.id,
            nextTpl,
            Math.floor(Date.now() / 1000) - 3900,
            RICH_WEEKS,
            richIds,
            { completed: false, loggedUpTo: 6 },
        )
    }

    let richWeighIns = 0
    for (let daysBack = 120; daysBack >= 0; daysBack--) {
        // A near-daily habit with holes; today always has an entry so the
        // dashboard card reads "current".
        if (daysBack !== 0 && rnd() < 0.3) continue
        const weight =
            78.6 - ((120 - daysBack) * 3.4) / 120 + (rnd() - 0.5) * 0.7
        insBodyweight.run(
            richUser.id,
            dayISO(daysBack),
            Math.round(weight * 10) / 10,
            at(daysBack, 7, 40),
        )
        richWeighIns++
    }
    summaries.push({
        email: RICH_EMAIL,
        templates: templates.length,
        workouts: plan.length + 1,
        sets: loggedSetCount,
        weighIns: richWeighIns,
    })

    // -- Fake accounts --------------------------------------------------------
    for (const fake of FAKE_ACCOUNTS) {
        const { id: userId } = upsertFakeUser.get({
            sub: fake.sub,
            email: fake.email,
            name: fake.name,
            cursor: richUser.catalogCursor,
        })!
        wipeUserData(userId)
        // Their exercises are wholly seed-owned: rebuild the catalog copy from
        // the rich account's rows, like signup would from EXERCISE_CATALOG.
        db.prepare(`delete from exercises where user_id = ?`).run(userId)
        cloneCatalog.run({ to: userId, from: richUser.id })
        ensureExercises(
            userId,
            EXERCISE_DEFS.filter((d) => d.source === 'catalog'),
        )
        const ids = exerciseIdsByName(userId)

        const tpl = buildTemplate(
            userId,
            fake.template,
            0,
            at(fake.weeks * 7 + 2, 12, 15),
            ids,
        )
        loggedSetCount = 0
        let workouts = 0
        for (let daysBack = fake.weeks * 7; daysBack >= 1; daysBack--) {
            if (!fake.days.includes(weekday(daysBack))) continue
            logWorkout(
                userId,
                tpl,
                at(
                    daysBack,
                    18 + Math.floor(rnd() * 2),
                    Math.floor(rnd() * 60),
                ),
                Math.floor((fake.weeks * 7 - daysBack) / 7),
                ids,
                { scale: fake.scale },
            )
            workouts++
        }
        let weighIns = 0
        for (
            let daysBack = fake.weeks * 7;
            daysBack >= 0;
            daysBack -= 3 + Math.floor(rnd() * 3)
        ) {
            const progress = 1 - daysBack / (fake.weeks * 7)
            const weight =
                fake.bodyweight.start
                + fake.bodyweight.drift * progress
                + (rnd() - 0.5) * 0.4
            insBodyweight.run(
                userId,
                dayISO(daysBack),
                Math.round(weight * 10) / 10,
                at(daysBack, 8, 10),
            )
            weighIns++
        }
        summaries.push({
            email: fake.email,
            templates: 1,
            workouts,
            sets: loggedSetCount,
            weighIns,
        })
    }

    return summaries
})

const summaries = seed()
db.close()

for (const s of summaries) {
    console.log(
        `Seeded ${s.email}: ${s.templates} templates, ${s.workouts} workouts (${s.sets} sets), ${s.weighIns} weigh-ins`,
    )
}
console.log('The running dev server picks this up on the next request.')
