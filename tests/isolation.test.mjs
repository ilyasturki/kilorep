/**
 * Two-user isolation test — the backstop behind "complete API separation".
 * Writes data as user A, then asserts every endpoint (REST + MCP) denies or
 * blanks it for user B, and that A's data survives untouched.
 *
 * Targets a RUNNING auth-mode instance (fake Google creds are fine):
 *   NUXT_OAUTH_GOOGLE_CLIENT_ID=x NUXT_OAUTH_GOOGLE_CLIENT_SECRET=y \
 *   NUXT_SESSION_PASSWORD=<password> DB_FILE_NAME=.data/test-auth.db \
 *   bunx nuxt dev --port 4099
 * then: node tests/isolation.test.mjs
 *
 * Users are created directly in the database (signup needs real Google);
 * sessions are forged with the known test password, exactly like the server
 * seals them.
 */
import { strict as assert } from 'node:assert'
import { randomBytes } from 'node:crypto'
import Database from 'better-sqlite3'

import { mintSession } from './mint-session.mjs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4099'
const DB_FILE = process.env.DB_FILE_NAME ?? '.data/test-auth.db'
const PASSWORD =
    process.env.NUXT_SESSION_PASSWORD
    ?? 'test-password-at-least-32-characters-long'

async function mintCookie(user) {
    return `nuxt-session=${await mintSession(user, PASSWORD, 60 * 60 * 1000)}`
}

async function api(cookie, path, { method = 'GET', body } = {}) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            cookie,
            ...(body ? { 'content-type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    })
    let json = null
    try {
        json = await res.json()
    } catch {
        // some error responses have no body worth parsing
    }
    return { status: res.status, body: json }
}

async function mcp(token, tool, args = {}) {
    const res = await fetch(`${BASE}/mcp`, {
        method: 'POST',
        headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
            accept: 'application/json, text/event-stream',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: { name: tool, arguments: args },
        }),
    })
    const json = await res.json()
    return {
        status: res.status,
        text: json?.result?.content?.[0]?.text,
        isError: json?.result?.isError === true,
    }
}

// ── Setup: two fresh accounts straight in the DB ────────────────────────────
const suffix = randomBytes(4).toString('hex')
const db = new Database(DB_FILE)
const insertUser = db.prepare(
    "INSERT INTO users (provider, provider_account_id, email, name) VALUES ('google', ?, ?, ?) RETURNING id",
)
const userA = insertUser.get(`iso-a-${suffix}`, 'a@iso.test', 'Iso A')
const userB = insertUser.get(`iso-b-${suffix}`, 'b@iso.test', 'Iso B')
db.close()

const cookieA = await mintCookie({ id: userA.id, name: 'Iso A' })
const cookieB = await mintCookie({ id: userB.id, name: 'Iso B' })

let failures = 0
function check(label, fn) {
    try {
        fn()
        console.log(`  ok  ${label}`)
    } catch (error) {
        failures++
        console.error(`FAIL  ${label}\n      ${error.message}`)
    }
}

// ── A creates one of everything ─────────────────────────────────────────────
console.log('\nA creates data')
const exA = await api(cookieA, '/api/exercises', {
    method: 'POST',
    body: {
        name: `Iso Press ${suffix}`,
        equipment: 'barbell',
        type: 'compound',
        muscles: [{ muscle: 'chest', intensity: 'high' }],
    },
})
check('create exercise', () => assert.equal(exA.status, 200))

const sesA = await api(cookieA, '/api/sessions', {
    method: 'POST',
    body: {
        name: `Iso Day ${suffix}`,
        entries: [
            { exercises: [{ exerciseId: exA.body.id, sets: [{ reps: 5 }] }] },
        ],
    },
})
check('create session', () => assert.equal(sesA.status, 200))

const wkA = await api(cookieA, '/api/workouts', {
    method: 'POST',
    body: { sessionId: sesA.body.id },
})
check('start workout', () => assert.equal(wkA.status, 200))

const bwA = await api(cookieA, '/api/bodyweight', {
    method: 'POST',
    body: { date: '2026-01-15', weight: 82.5 },
})
check('log weigh-in', () => assert.equal(bwA.status, 200))

// ── B sees none of it ───────────────────────────────────────────────────────
console.log('\nB reads are blank')
for (const path of [
    '/api/exercises',
    '/api/sessions',
    '/api/workouts',
    '/api/bodyweight',
]) {
    const res = await api(cookieB, path)
    check(`GET ${path} is empty`, () => {
        assert.equal(res.status, 200)
        assert.deepEqual(res.body, [])
    })
}

// ── B cannot touch A's resources ────────────────────────────────────────────
console.log("\nB's cross-user requests 404")
const validSession = {
    name: 'x',
    entries: [
        { exercises: [{ exerciseId: exA.body.id, sets: [{ reps: 1 }] }] },
    ],
}
const validWorkout = {
    entries: [
        { exercises: [{ exerciseId: exA.body.id, sets: [{ reps: 1 }] }] },
    ],
}
const attempts = [
    ['GET', `/api/exercises/${exA.body.id}`, undefined, 404],
    ['PATCH', `/api/exercises/${exA.body.id}`, exA.body, 404],
    ['DELETE', `/api/exercises/${exA.body.id}`, undefined, 404],
    ['PUT', `/api/sessions/${sesA.body.id}`, validSession, 404],
    ['DELETE', `/api/sessions/${sesA.body.id}`, undefined, 404],
    ['GET', `/api/workouts/${wkA.body.id}`, undefined, 404],
    ['PUT', `/api/workouts/${wkA.body.id}`, validWorkout, 404],
    ['DELETE', `/api/workouts/${wkA.body.id}`, undefined, 404],
    // referencing A's ids in B's own payloads must read as "unknown id"
    ['POST', '/api/workouts', { sessionId: sesA.body.id }, 404],
    ['POST', '/api/sessions', validSession, 400],
    [
        'PATCH',
        `/api/bodyweight/${bwA.body.id}`,
        { date: '2026-01-15', weight: 70 },
        404,
    ],
    ['DELETE', `/api/bodyweight/${bwA.body.id}`, undefined, 404],
]
for (const [method, path, body, expected] of attempts) {
    const res = await api(cookieB, path, { method, body })
    check(`${method} ${path} → ${expected}`, () =>
        assert.equal(res.status, expected),
    )
}

// ── MCP is scoped per token ─────────────────────────────────────────────────
console.log('\nMCP bearer scoping')
const tokenA = (await api(cookieA, '/api/account/token', { method: 'POST' }))
    .body.token
const tokenB = (await api(cookieB, '/api/account/token', { method: 'POST' }))
    .body.token

const listA = await mcp(tokenA, 'list_workouts')
check("A's token sees A's workout", () => {
    assert.equal(listA.status, 200)
    assert.match(listA.text, new RegExp(`Iso Day ${suffix}`))
})

const listB = await mcp(tokenB, 'list_workouts')
check("B's token sees no workouts", () => {
    assert.equal(listB.status, 200)
    assert.match(listB.text, /No workouts logged yet/)
})

const deleteAttempt = await mcp(tokenB, 'delete_workout', {
    workout: wkA.body.id,
})
check("B's token cannot delete A's workout", () => {
    assert.equal(deleteAttempt.isError, true)
    assert.match(deleteAttempt.text, /No workout with id/)
})

// ── A's data is intact ──────────────────────────────────────────────────────
console.log("\nA's data intact")
const finalA = await api(cookieA, '/api/workouts')
check('A still has the workout', () => {
    assert.equal(finalA.status, 200)
    assert.equal(finalA.body.length, 1)
    assert.equal(finalA.body[0].id, wkA.body.id)
})

// ── Cleanup via account deletion (also exercises that path) ────────────────
console.log('\nCleanup')
for (const [label, cookie] of [
    ['A', cookieA],
    ['B', cookieB],
]) {
    const res = await api(cookie, '/api/account', { method: 'DELETE' })
    check(`delete account ${label}`, () => assert.equal(res.status, 200))
}
const dbCheck = new Database(DB_FILE, { readonly: true })
const remaining = dbCheck
    .prepare(
        'SELECT COUNT(*) AS n FROM users WHERE provider_account_id IN (?, ?)',
    )
    .get(`iso-a-${suffix}`, `iso-b-${suffix}`)
dbCheck.close()
check('accounts fully removed', () => assert.equal(remaining.n, 0))

console.log(
    failures === 0 ?
        '\nAll isolation checks passed.'
    :   `\n${failures} check(s) FAILED`,
)
process.exit(failures === 0 ? 0 : 1)
