/**
 * Two-user isolation test — the backstop behind "complete API separation".
 * Writes data as user A, then asserts every endpoint (REST + MCP) denies or
 * blanks it for user B — over the sealed session cookie AND the bearer-token
 * path the native app uses — and that A's data survives untouched.
 *
 * Targets a RUNNING auth-mode instance (fake Google creds are fine):
 *   NUXT_OAUTH_GOOGLE_CLIENT_ID=x NUXT_OAUTH_GOOGLE_CLIENT_SECRET=y \
 *   NUXT_SESSION_PASSWORD=<password> DB_FILE_NAME=.data/test-auth.db \
 *   NUXT_GOOGLE_JWKS_URL=http://localhost:4098/jwks \
 *   NUXT_IGNORE_LOCK=1 bunx nuxt dev --port 4099
 * then: node tests/isolation.test.mjs
 *
 * The suite serves its own JWKS on :4098 and signs its own Google-shaped ID
 * tokens, so device sign-in exercises the real verification path end to end.
 * The single-user checks boot a second, credential-less instance on :4097
 * (or use SOLO_BASE_URL instead when set).
 *
 * Users are created directly in the database (signup needs real Google);
 * sessions are forged with the known test password, exactly like the server
 * seals them.
 */
import { strict as assert } from 'node:assert'
import { spawn } from 'node:child_process'
import { generateKeyPairSync, randomBytes, sign } from 'node:crypto'
import { createServer } from 'node:http'
import Database from 'better-sqlite3'

import { mintSession } from './mint-session.mjs'

const BASE = process.env.BASE_URL ?? 'http://localhost:4099'
const DB_FILE = process.env.DB_FILE_NAME ?? '.data/test-auth.db'
const PASSWORD =
    process.env.NUXT_SESSION_PASSWORD
    ?? 'test-password-at-least-32-characters-long'
// Must match the instance's NUXT_OAUTH_GOOGLE_CLIENT_ID: it is the audience
// device sign-in validates ID tokens against.
const CLIENT_ID = process.env.NUXT_OAUTH_GOOGLE_CLIENT_ID ?? 'x'
const JWKS_PORT = Number(process.env.JWKS_PORT ?? 4098)
const SOLO_PORT = Number(process.env.SOLO_PORT ?? 4097)
const SOLO_BASE = process.env.SOLO_BASE_URL ?? `http://localhost:${SOLO_PORT}`

// ── Google-shaped ID tokens, signed with our own throwaway key ─────────────
const KEY_ID = 'iso-test-key'
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
})
const JWKS = {
    keys: [
        {
            ...publicKey.export({ format: 'jwk' }),
            kid: KEY_ID,
            alg: 'RS256',
            use: 'sig',
        },
    ],
}

const b64json = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')

function signIdToken(claims) {
    const now = Math.floor(Date.now() / 1000)
    const header = b64json({ alg: 'RS256', typ: 'JWT', kid: KEY_ID })
    const payload = b64json({
        iss: 'https://accounts.google.com',
        aud: CLIENT_ID,
        iat: now,
        exp: now + 3600,
        ...claims,
    })
    const signature = sign(
        'sha256',
        Buffer.from(`${header}.${payload}`),
        privateKey,
    ).toString('base64url')
    return `${header}.${payload}.${signature}`
}

const jwksServer = createServer((_req, res) => {
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(JWKS))
})
await new Promise((resolve, reject) => {
    jwksServer.listen(JWKS_PORT, resolve)
    jwksServer.on('error', reject)
})

// ── Single-user instance, booted now so it's ready when we get to it ───────
let soloChild = null
if (!process.env.SOLO_BASE_URL) {
    soloChild = spawn('bunx', ['nuxt', 'dev', '--port', String(SOLO_PORT)], {
        env: {
            ...process.env,
            // Explicitly blanked: nuxt dev reads .env, and any OAuth creds
            // reaching the child would boot it multi-user.
            NUXT_OAUTH_GOOGLE_CLIENT_ID: '',
            NUXT_OAUTH_GOOGLE_CLIENT_SECRET: '',
            DB_FILE_NAME: '.data/test-solo.db',
            NUXT_IGNORE_LOCK: '1',
        },
        stdio: 'ignore',
        detached: true,
    })
    process.on('exit', () => {
        // Negative pid: the detached child leads its own process group, and
        // nuxt dev workers must die with it or they keep the port.
        try {
            process.kill(-soloChild.pid, 'SIGTERM')
        } catch {
            // already gone
        }
    })
}

async function waitForMode(base, timeoutMs = 120_000) {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        try {
            const res = await fetch(`${base}/api/auth/mode`)
            if (res.ok) return await res.json()
        } catch {
            // not up yet
        }
        await new Promise((resolve) => setTimeout(resolve, 500))
    }
    return null
}

async function mintCookie(user) {
    return {
        cookie: `nuxt-session=${await mintSession(user, PASSWORD, 60 * 60 * 1000)}`,
    }
}

const asBearer = (token) => ({ authorization: `Bearer ${token}` })

async function api(auth, path, { method = 'GET', body, base = BASE } = {}) {
    const res = await fetch(`${base}${path}`, {
        method,
        headers: {
            ...auth,
            ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
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
// CI boots the auth-mode instance in the background and runs this suite
// immediately; the DB file and its schema only exist once the server is up,
// so wait before opening it.
const baseMode = await waitForMode(BASE)
assert.ok(baseMode, `no instance reachable at ${BASE}`)
assert.equal(
    baseMode.authEnabled,
    true,
    `instance at ${BASE} is not in auth mode`,
)

const suffix = randomBytes(4).toString('hex')
const db = new Database(DB_FILE)
const insertUser = db.prepare(
    "INSERT INTO users (provider, provider_account_id, email, name) VALUES ('google', ?, ?, ?) RETURNING id",
)
const userA = insertUser.get(`iso-a-${suffix}`, 'a@iso.test', 'Iso A')
const userB = insertUser.get(`iso-b-${suffix}`, 'b@iso.test', 'Iso B')
// C exists only to exercise the session kill switch, which ends its own
// cookies — keeping that away from A and B, whose cookies the rest of the
// suite depends on.
const userC = insertUser.get(`iso-c-${suffix}`, 'c@iso.test', 'Iso C')
db.close()

const cookieA = await mintCookie({ id: userA.id, name: 'Iso A' })
const cookieB = await mintCookie({ id: userB.id, name: 'Iso B' })
const cookieC = await mintCookie({ id: userC.id, name: 'Iso C' })

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

// ── Device sign-in: Google ID token → long-lived device token ──────────────
console.log('\nDevice sign-in (native app)')
async function deviceSignIn(claims, deviceName) {
    return api({}, '/api/auth/device', {
        method: 'POST',
        body: { idToken: signIdToken(claims), deviceName },
    })
}

const deviceA = await deviceSignIn(
    { sub: `iso-a-${suffix}`, email: 'a@iso.test', name: 'Iso A' },
    'Iso Pixel A',
)
check('A signs in and gets a device token', () => {
    assert.equal(deviceA.status, 200)
    assert.match(deviceA.body.token, /^kr_/)
    assert.equal(deviceA.body.record.label, 'Iso Pixel A')
})

const deviceB = await deviceSignIn(
    { sub: `iso-b-${suffix}`, email: 'b@iso.test', name: 'Iso B' },
    'Iso Pixel B',
)
check('B signs in and gets a device token', () =>
    assert.equal(deviceB.status, 200),
)

// Optional-chained below: a failed sign-in must degrade into FAILed checks,
// not crash the run before cleanup and the summary.
const deviceTokenA = deviceA.body?.token
const deviceTokenB = deviceB.body?.token
const bearerA = asBearer(deviceTokenA)
const bearerB = asBearer(deviceTokenB)

const dbDup = new Database(DB_FILE, { readonly: true })
const googleUsers = dbDup
    .prepare(
        'SELECT COUNT(*) AS n FROM users WHERE provider_account_id IN (?, ?)',
    )
    .get(`iso-a-${suffix}`, `iso-b-${suffix}`)
dbDup.close()
check('sign-in resolved the existing accounts, no duplicates', () =>
    assert.equal(googleUsers.n, 2),
)

const wrongAudience = await api({}, '/api/auth/device', {
    method: 'POST',
    body: {
        idToken: signIdToken({ sub: `iso-a-${suffix}`, aud: 'someone-else' }),
    },
})
check('wrong audience → 401', () => assert.equal(wrongAudience.status, 401))

const expired = await api({}, '/api/auth/device', {
    method: 'POST',
    body: {
        idToken: signIdToken({
            sub: `iso-a-${suffix}`,
            exp: Math.floor(Date.now() / 1000) - 60,
        }),
    },
})
check('expired token → 401', () => assert.equal(expired.status, 401))

const garbage = await api({}, '/api/auth/device', {
    method: 'POST',
    body: { idToken: 'not-a-jwt' },
})
check('malformed token → 401', () => assert.equal(garbage.status, 401))

const missing = await api({}, '/api/auth/device', { method: 'POST', body: {} })
check('missing idToken → 400', () => assert.equal(missing.status, 400))

// Re-onboarding signs in again under the same device name: it must rotate
// that device's token, not stack rows toward the token limit.
const rotateName = `Iso Rotate ${suffix}`
const rotateFirst = await deviceSignIn(
    { sub: `iso-a-${suffix}`, email: 'a@iso.test' },
    rotateName,
)
const rotateSecond = await deviceSignIn(
    { sub: `iso-a-${suffix}`, email: 'a@iso.test' },
    rotateName,
)
const rotatedList = await api(cookieA, '/api/account/tokens')
check('same-device re-sign-in leaves exactly one token', () => {
    assert.equal(rotateFirst.status, 200)
    assert.equal(rotateSecond.status, 200)
    const matching = (rotatedList.body ?? []).filter(
        (t) => t.label === rotateName,
    )
    assert.equal(matching.length, 1)
    assert.equal(matching[0].id, rotateSecond.body?.record?.id)
})

const rotatedOut = await api(asBearer(rotateFirst.body?.token), '/api/workouts')
check('the rotated-out token no longer authenticates', () =>
    assert.equal(rotatedOut.status, 401),
)

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

// ── The bearer path reaches /api/* ──────────────────────────────────────────
console.log('\nDevice tokens on /api')
const bearerRead = await api(bearerA, '/api/workouts')
check("A's device token reads A's workouts", () => {
    assert.equal(bearerRead.status, 200)
    assert.equal(bearerRead.body.length, 1)
    assert.equal(bearerRead.body[0].id, wkA.body.id)
})

const unknownBearer = await api(asBearer('kr_no-such-token'), '/api/workouts')
check('unknown bearer token → 401', () =>
    assert.equal(unknownBearer.status, 401),
)

const anonymous = await api({}, '/api/workouts')
check('no credentials at all → 401', () => assert.equal(anonymous.status, 401))

// ── ...but not /api/account: a stolen token must stay revocable ─────────────
console.log('\nBearer tokens are scoped out of account management')
const bearerMint = await api(bearerA, '/api/account/tokens', {
    method: 'POST',
    body: { label: 'escalated' },
})
check('bearer token cannot mint sibling tokens → 403', () =>
    assert.equal(bearerMint.status, 403),
)

const bearerTokenList = await api(bearerA, '/api/account/tokens')
check('bearer token cannot list tokens → 403', () =>
    assert.equal(bearerTokenList.status, 403),
)

const bearerAccountDelete = await api(bearerA, '/api/account', {
    method: 'DELETE',
})
check('bearer token cannot delete the account → 403', () =>
    assert.equal(bearerAccountDelete.status, 403),
)

// ── B sees none of it, over both auth paths ─────────────────────────────────
console.log('\nB reads are blank')
for (const [flavor, auth] of Object.entries({
    cookie: cookieB,
    'device token': bearerB,
})) {
    for (const path of [
        '/api/exercises',
        '/api/sessions',
        '/api/workouts',
        '/api/bodyweight',
    ]) {
        const res = await api(auth, path)
        check(`GET ${path} is empty [${flavor}]`, () => {
            assert.equal(res.status, 200)
            assert.deepEqual(res.body, [])
        })
    }
}

// ── B cannot touch A's resources, over both auth paths ──────────────────────
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
// B's own exercise, the source for cross-user merge probes below.
const exB = await api(cookieB, '/api/exercises', {
    method: 'POST',
    body: {
        name: `Iso Curl ${suffix}`,
        equipment: 'dumbbell',
        type: 'isolation',
        muscles: [{ muscle: 'biceps', intensity: 'high' }],
    },
})
check('B creates an exercise', () => assert.equal(exB.status, 200))
const attempts = [
    ['GET', `/api/exercises/${exA.body.id}`, undefined, 404],
    ['PATCH', `/api/exercises/${exA.body.id}`, exA.body, 404],
    ['DELETE', `/api/exercises/${exA.body.id}`, undefined, 404],
    [
        'POST',
        `/api/exercises/${exA.body.id}/merge`,
        { targetId: exB.body.id },
        404,
    ],
    // merging B's own exercise into A's must read as "unknown id"
    [
        'POST',
        `/api/exercises/${exB.body.id}/merge`,
        { targetId: exA.body.id },
        400,
    ],
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
for (const [flavor, auth] of Object.entries({
    cookie: cookieB,
    'device token': bearerB,
})) {
    for (const [method, path, body, expected] of attempts) {
        const res = await api(auth, path, { method, body })
        check(`${method} ${path} → ${expected} [${flavor}]`, () =>
            assert.equal(res.status, expected),
        )
    }
}

// ── Tokens are scoped per user ──────────────────────────────────────────────
console.log('\nToken management scoping')
const mintRespA = await api(cookieA, '/api/account/tokens', {
    method: 'POST',
    body: { label: 'iso-a' },
})
const mintRespB = await api(cookieB, '/api/account/tokens', {
    method: 'POST',
    body: { label: 'iso-b' },
})
check('both users can mint tokens', () => {
    assert.equal(mintRespA.status, 200)
    assert.equal(mintRespB.status, 200)
})
// Optional-chained below: a failed mint must degrade into FAILed checks, not
// crash the run before cleanup and the summary.
const mintA = mintRespA.body ?? {}
const mintB = mintRespB.body ?? {}
const tokenA = mintA.token
const tokenB = mintB.token

const tokenListB = await api(cookieB, '/api/account/tokens')
check("B's token list holds B's device and MCP tokens only", () => {
    assert.equal(tokenListB.status, 200)
    assert.deepEqual(
        tokenListB.body.map((t) => t.id),
        [deviceB.body?.record?.id, mintB.record?.id],
    )
})

const tokenDelete = await api(
    cookieB,
    `/api/account/tokens/${mintA.record?.id}`,
    { method: 'DELETE' },
)
check("B cannot delete A's token", () => assert.equal(tokenDelete.status, 404))

const tokenRename = await api(
    cookieB,
    `/api/account/tokens/${mintA.record?.id}`,
    { method: 'PATCH', body: { label: 'hijacked' } },
)
check("B cannot rename A's token", () => assert.equal(tokenRename.status, 404))

// ── MCP is scoped per token ─────────────────────────────────────────────────
console.log('\nMCP bearer scoping')

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

const deviceOnMcp = await mcp(deviceTokenA, 'list_workouts')
check("A's device token works on /mcp too", () => {
    assert.equal(deviceOnMcp.status, 200)
    assert.match(deviceOnMcp.text, new RegExp(`Iso Day ${suffix}`))
})

// ── Revocation cuts a device off immediately ────────────────────────────────
console.log('\nDevice token revocation')
const revoke = await api(
    cookieA,
    `/api/account/tokens/${deviceA.body?.record?.id}`,
    { method: 'DELETE' },
)
check('A revokes the device token from web settings', () =>
    assert.equal(revoke.status, 200),
)

const revokedApi = await api(bearerA, '/api/workouts')
check('revoked token is rejected on /api', () =>
    assert.equal(revokedApi.status, 401),
)

const revokedMcp = await mcp(deviceTokenA, 'list_workouts')
check('revoked token is rejected on /mcp', () =>
    assert.equal(revokedMcp.status, 401),
)

const otherTokenStillWorks = await mcp(tokenA, 'list_workouts')
check("A's other token survives the revocation", () =>
    assert.equal(otherTokenStillWorks.status, 200),
)

// ── Session kill switch ─────────────────────────────────────────────────────
// C signs its other browsers out: every cookie issued before the cut-off dies,
// the caller is re-issued a live one, and nobody else's session is touched.
console.log('\nSession revocation')
const beforeRevoke = await api(cookieC, '/api/workouts')
check("C's session works before revoking", () =>
    assert.equal(beforeRevoke.status, 200),
)

const revokeRes = await fetch(`${BASE}/api/account/sessions`, {
    method: 'DELETE',
    headers: cookieC,
})
check('C revokes its other sessions', () => assert.equal(revokeRes.status, 200))

const reissued = revokeRes.headers
    .getSetCookie()
    .find((c) => c.startsWith('nuxt-session='))
check('the revoking browser is re-issued a session', () =>
    assert.ok(reissued, 'no nuxt-session cookie on the revoke response'),
)

const oldCookie = await api(cookieC, '/api/workouts')
check("C's pre-revocation cookie is rejected", () =>
    assert.equal(oldCookie.status, 401),
)

const cookieCLive = { cookie: reissued?.split(';')[0] ?? '' }
const newCookie = await api(cookieCLive, '/api/workouts')
check('the re-issued cookie still works', () =>
    assert.equal(newCookie.status, 200),
)

const bearerSurvives = await mcp(tokenA, 'list_workouts')
check("C's revocation leaves device tokens alone", () =>
    assert.equal(bearerSurvives.status, 200),
)

// ── A's data is intact ──────────────────────────────────────────────────────
console.log("\nA's data intact")
const finalA = await api(cookieA, '/api/workouts')
check('A still has the workout', () => {
    assert.equal(finalA.status, 200)
    assert.equal(finalA.body.length, 1)
    assert.equal(finalA.body[0].id, wkA.body.id)
})

// ── Single-user mode: no sign-in to disable, /api open as the local user ───
console.log('\nSingle-user instance')
const soloMode = await waitForMode(SOLO_BASE)
check('solo instance is up and reports auth off', () => {
    assert.ok(soloMode, `no /api/auth/mode response from ${SOLO_BASE}`)
    assert.equal(soloMode.authEnabled, false)
})
if (soloMode) {
    const soloRead = await api({}, '/api/workouts', { base: SOLO_BASE })
    check('solo /api needs no credentials', () =>
        assert.equal(soloRead.status, 200),
    )
    const soloSignIn = await api({}, '/api/auth/device', {
        method: 'POST',
        body: { idToken: signIdToken({ sub: 'solo-probe' }) },
        base: SOLO_BASE,
    })
    check('device sign-in 404s in single-user mode', () =>
        assert.equal(soloSignIn.status, 404),
    )
} else {
    console.error('      skipping solo checks (instance unreachable)')
}

// ── Cleanup via account deletion (also exercises that path) ────────────────
console.log('\nCleanup')
// C deletes with its re-issued cookie; the pre-revocation one is dead by design.
for (const [label, cookie] of Object.entries({
    A: cookieA,
    B: cookieB,
    C: cookieCLive,
})) {
    const res = await api(cookie, '/api/account', { method: 'DELETE' })
    check(`delete account ${label}`, () => assert.equal(res.status, 200))
}
const dbCheck = new Database(DB_FILE, { readonly: true })
const remaining = dbCheck
    .prepare(
        'SELECT COUNT(*) AS n FROM users WHERE provider_account_id IN (?, ?, ?)',
    )
    .get(`iso-a-${suffix}`, `iso-b-${suffix}`, `iso-c-${suffix}`)
const remainingTokens = dbCheck
    .prepare('SELECT COUNT(*) AS n FROM api_tokens WHERE user_id IN (?, ?, ?)')
    .get(userA.id, userB.id, userC.id)
dbCheck.close()
check('accounts fully removed', () => assert.equal(remaining.n, 0))
check('tokens removed with accounts', () => assert.equal(remainingTokens.n, 0))

console.log(
    failures === 0 ?
        '\nAll isolation checks passed.'
    :   `\n${failures} check(s) FAILED`,
)
process.exit(failures === 0 ? 0 : 1)
