/**
 * Contract test — the committed OpenAPI spec (openapi/kilorep.json) is what
 * the Android client is generated from, so every REST response is validated
 * against it here, over real HTTP. If a route's shape drifts from its
 * defineRouteMeta annotation, this fails before the drift can break the gym.
 *
 * Self-contained: boots a credential-less single-user instance on :4096
 * with a throwaway DB (or targets CONTRACT_BASE_URL when set). Auth-mode-only
 * endpoints (tokens, device sign-in, account deletion) 404 here by design;
 * their bearer-path behavior is the isolation suite's job.
 */
import { strict as assert } from 'node:assert'
import { spawn } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import addFormats from 'ajv-formats'
import { Ajv2020 } from 'ajv/dist/2020.js'

import { buildDocument, OPENAPI_ROUTE } from '../scripts/export-openapi.mjs'

const PORT = Number(process.env.CONTRACT_PORT ?? 4096)
const BASE = process.env.CONTRACT_BASE_URL ?? `http://localhost:${PORT}`
const DB_FILE = '.data/test-contract.db'

const spec = JSON.parse(
    readFileSync(new URL('../openapi/kilorep.json', import.meta.url), 'utf8'),
)

// ── Validator: components become $defs so plain JSON-pointer $refs resolve ──
const rewriteRefs = (node) => {
    if (Array.isArray(node)) return node.map(rewriteRefs)
    if (node && typeof node === 'object') {
        return Object.fromEntries(
            Object.entries(node).map(([key, value]) => [
                key,
                key === '$ref' && typeof value === 'string' ?
                    value.replace('#/components/schemas/', '#/$defs/')
                :   rewriteRefs(value),
            ]),
        )
    }
    return node
}

const ajv = new Ajv2020({ strict: false, allErrors: true })
addFormats(ajv)
const validators = new Map()

function validatorFor(path, method, status) {
    const key = `${method} ${path} ${status}`
    if (validators.has(key)) return validators.get(key)
    const operation = spec.paths[path]?.[method]
    assert.ok(operation, `spec has no operation for ${method} ${path}`)
    const schema =
        operation.responses?.[String(status)]?.content?.['application/json']
            ?.schema
    assert.ok(schema, `spec has no ${status} schema for ${method} ${path}`)
    const compiled = ajv.compile({
        ...rewriteRefs(schema),
        $defs: rewriteRefs(spec.components.schemas),
    })
    validators.set(key, compiled)
    return compiled
}

let passed = 0
const failures = []
function check(name, fn) {
    try {
        fn()
        passed++
        console.log(`  ✓ ${name}`)
    } catch (error) {
        failures.push({ name, error })
        console.error(`  ✗ ${name}\n    ${error.message}`)
    }
}

// Every (method, path, status) exercised through call(), for the coverage
// gate at the end: a spec'd success response nobody calls is dead contract.
const exercised = new Set()

/** Calls the API and validates the body against the spec'd schema. */
async function call(
    specPath,
    { method = 'get', body, expect = 200, url } = {},
) {
    exercised.add(`${method} ${specPath} ${expect}`)
    const target = url ?? specPath
    // A lost connection must fail the run, not hang it (CI has no babysitter).
    const res = await fetch(`${BASE}${target}`, {
        method: method.toUpperCase(),
        headers: body ? { 'content-type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(30_000),
    })
    const json = await res.json().catch(() => null)
    check(
        `${method.toUpperCase()} ${target} → ${expect} matches the contract`,
        () => {
            assert.equal(
                res.status,
                expect,
                JSON.stringify(json)?.slice(0, 300),
            )
            const validate = validatorFor(specPath, method, expect)
            const valid = validate(json)
            assert.ok(
                valid,
                `response violates spec:\n${JSON.stringify(validate.errors, null, 2)}\n`
                    + `body: ${JSON.stringify(json)?.slice(0, 500)}`,
            )
        },
    )
    return json
}

// ── Boot a throwaway single-user instance ───────────────────────────────────
let child
if (!process.env.CONTRACT_BASE_URL) {
    rmSync(DB_FILE, { force: true })
    child = spawn('bunx', ['nuxt', 'dev', '--port', String(PORT)], {
        env: {
            ...process.env,
            NUXT_OAUTH_GOOGLE_CLIENT_ID: '',
            NUXT_OAUTH_GOOGLE_CLIENT_SECRET: '',
            DB_FILE_NAME: DB_FILE,
            NUXT_IGNORE_LOCK: '1',
        },
        stdio: 'ignore',
        detached: true,
    })
    // Without unref the detached child keeps the event loop alive and the
    // suite never exits on success.
    child.unref()
    process.on('exit', () => {
        try {
            process.kill(-child.pid, 'SIGTERM')
        } catch {
            // already gone
        }
    })
}

const deadline = Date.now() + 120_000
let up = false
while (Date.now() < deadline && !up) {
    try {
        const res = await fetch(`${BASE}/api/auth/mode`)
        up = res.ok
    } catch {
        // not bound yet
    }
    // Also pause on non-ok responses — a bound-but-503 server must not be
    // hammered full speed.
    if (!up) await new Promise((resolve) => setTimeout(resolve, 500))
}
assert.ok(up, `no instance reachable at ${BASE}`)

console.log(
    `\nContract: ${BASE} against openapi/kilorep.json v${spec.info.version}\n`,
)

// ── Auth mode ───────────────────────────────────────────────────────────────
await call('/api/auth/mode')

// ── Exercises ───────────────────────────────────────────────────────────────
const bench = await call('/api/exercises', {
    method: 'post',
    body: {
        name: `Bench Press ${Date.now()}`,
        equipment: 'barbell',
        type: 'compound',
        muscles: [
            { muscle: 'chest', intensity: 'high' },
            { muscle: 'triceps', intensity: 'medium' },
        ],
    },
})
const fly = await call('/api/exercises', {
    method: 'post',
    body: {
        name: `Pec Fly ${Date.now()}`,
        equipment: 'machine',
        type: 'isolation',
        muscles: [{ muscle: 'chest', intensity: 'high' }],
    },
})
await call('/api/exercises')
await call('/api/exercises/{id}', { url: `/api/exercises/${bench.id}` })
await call('/api/exercises/{id}', {
    method: 'patch',
    url: `/api/exercises/${bench.id}`,
    body: {
        name: bench.name,
        equipment: 'dumbbell',
        type: 'compound',
        muscles: [{ muscle: 'chest', intensity: 'high' }],
    },
})

// ── Sessions: superset + open target ────────────────────────────────────────
const session = await call('/api/sessions', {
    method: 'post',
    body: {
        name: 'Contract Push Day',
        entries: [
            {
                exercises: [
                    {
                        exerciseId: bench.id,
                        sets: [{ reps: 8 }, { reps: null }],
                    },
                    { exerciseId: fly.id, sets: [{ reps: 15 }] },
                ],
            },
        ],
    },
})
await call('/api/sessions')
await call('/api/sessions/{id}', {
    method: 'put',
    url: `/api/sessions/${session.id}`,
    body: {
        name: 'Contract Push Day v2',
        entries: [
            { exercises: [{ exerciseId: bench.id, sets: [{ reps: 5 }] }] },
        ],
    },
})
// Reorder demands every session id exactly once, so derive the permutation
// from the live list — the test must not assume a virgin database.
const allSessions = await call('/api/sessions')
await call('/api/sessions/reorder', {
    method: 'patch',
    body: { ids: allSessions.map((s) => s.id).reverse() },
})

// ── The gym loop over HTTP: start → log → finish → sync-back ───────────────
const workout = await call('/api/workouts', {
    method: 'post',
    body: { sessionId: session.id },
})
await call('/api/workouts/{id}', { url: `/api/workouts/${workout.id}` })
await call('/api/workouts/{id}', {
    method: 'put',
    url: `/api/workouts/${workout.id}`,
    body: {
        completed: true,
        entries: [
            {
                exercises: [
                    {
                        exerciseId: bench.id,
                        sets: [
                            { reps: 5, weight: 80, done: true },
                            { reps: 5, weight: 82.5, done: true },
                        ],
                    },
                ],
            },
        ],
    },
})
await call('/api/workouts')
await call('/api/workouts/{id}/to-session', {
    method: 'post',
    url: `/api/workouts/${workout.id}/to-session`,
    body: { mode: 'create', name: 'Contract Heavy Day' },
})

// ── Bodyweight ──────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10)
const weighIn = await call('/api/bodyweight', {
    method: 'post',
    body: { date: today, weight: 82.4 },
})
await call('/api/bodyweight')
await call('/api/bodyweight/{id}', {
    method: 'patch',
    url: `/api/bodyweight/${weighIn.id}`,
    body: { date: today, weight: 82.6 },
})
await call('/api/bodyweight/{id}', {
    method: 'delete',
    url: `/api/bodyweight/${weighIn.id}`,
})

// ── Delete success paths: a throwaway session + exercise ───────────────────
const throwawayEx = await call('/api/exercises', {
    method: 'post',
    body: {
        name: `Throwaway Curl ${Date.now()}`,
        equipment: 'dumbbell',
        type: 'isolation',
        muscles: [{ muscle: 'biceps', intensity: 'high' }],
    },
})
const throwawaySession = await call('/api/sessions', {
    method: 'post',
    body: {
        name: 'Contract Throwaway Day',
        entries: [
            {
                exercises: [
                    { exerciseId: throwawayEx.id, sets: [{ reps: 10 }] },
                ],
            },
        ],
    },
})
await call('/api/sessions/{id}', {
    method: 'delete',
    url: `/api/sessions/${throwawaySession.id}`,
})
// Only deletable now that the session referencing it is gone.
await call('/api/exercises/{id}', {
    method: 'delete',
    url: `/api/exercises/${throwawayEx.id}`,
})

// ── Merge + deletes (and the structured 409) ────────────────────────────────
await call('/api/exercises/{id}', {
    method: 'delete',
    url: `/api/exercises/${bench.id}`,
    expect: 409,
})
await call('/api/workouts/{id}', {
    method: 'delete',
    url: `/api/workouts/${workout.id}`,
})
await call('/api/exercises/{id}/merge', {
    method: 'post',
    url: `/api/exercises/${fly.id}/merge`,
    body: { targetId: bench.id },
})

// ── Error shapes ────────────────────────────────────────────────────────────
await call('/api/workouts/{id}', { url: '/api/workouts/999999', expect: 404 })
await call('/api/sessions', { method: 'post', body: { name: '' }, expect: 400 })

// ── Coverage gate: every documented success response gets exercised ─────────
// Operations this solo instance cannot reach, with the reason each is excused.
const coverageExclusions = {
    'post /api/auth/device': 'auth mode only (404s here); isolation suite',
    'delete /api/account': 'auth mode only (404s here); isolation suite',
    'get /api/account/tokens': 'auth mode only (404s here); isolation suite',
    'post /api/account/tokens': 'auth mode only (404s here); isolation suite',
    'delete /api/account/tokens/{id}':
        'auth mode only (404s here); isolation suite',
    'patch /api/account/tokens/{id}':
        'auth mode only (404s here); isolation suite',
}
const unexercised = []
for (const [path, operations] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(operations)) {
        if (coverageExclusions[`${method} ${path}`]) continue
        for (const status of Object.keys(operation.responses ?? {})) {
            if (!/^2\d\d$/.test(status)) continue
            const key = `${method} ${path} ${status}`
            if (!exercised.has(key)) unexercised.push(key)
        }
    }
}
check('every spec success response is exercised or excluded', () =>
    assert.deepEqual(
        unexercised,
        [],
        `unexercised operations:\n${unexercised.join('\n')}`,
    ),
)

// ── Drift gate: the committed spec still matches the live route metas ───────
const rawSpecRes = await fetch(`${BASE}${OPENAPI_ROUTE}`)
const rawSpec = await rawSpecRes.json()
const components = JSON.parse(
    readFileSync(
        new URL('../openapi/components.json', import.meta.url),
        'utf8',
    ),
)
const pkg = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
)
check('committed openapi/kilorep.json matches the live route metas', () => {
    try {
        assert.deepStrictEqual(
            buildDocument(rawSpec, components, pkg.version),
            spec,
        )
    } catch (error) {
        error.message = `spec drift detected: run \`bun run openapi:export\` against a live instance and review the diff.\n${error.message}`
        throw error
    }
})

// ── Verdict ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failures.length} failed`)
process.exit(failures.length > 0 ? 1 : 0)
