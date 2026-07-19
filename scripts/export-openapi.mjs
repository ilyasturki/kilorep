/**
 * Exports the committed OpenAPI contract (openapi/kilorep.json) that the
 * Android client is code-generated from.
 *
 * Nitro assembles the document at runtime from the defineRouteMeta
 * annotations on each /api route, but its experimental openAPI support has
 * no notion of shared component schemas — so this script reads the spec
 * from a RUNNING dev instance (BASE_URL, default the usual dev server),
 * keeps only /api/* paths, merges in openapi/components.json, validates the
 * result and writes it pretty-printed for stable diffs.
 *
 * The transform is exported (buildDocument) so the contract test can rebuild
 * the document from its own live instance and fail on drift from the
 * committed file; importing this module runs nothing.
 *
 *   bun run openapi:export
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

/** The Nitro endpoint serving the runtime-assembled spec on a dev instance. */
export const OPENAPI_ROUTE = '/_openapi.json'

/**
 * Pure transform from Nitro's runtime document to the committed contract:
 * /api/* paths only, path params deduped, shared components merged, version
 * pinned. Throws on incomplete route metas instead of returning a broken
 * document, so neither the export nor the drift check can let one through.
 */
export function buildDocument(rawSpec, components, version) {
    // Only the REST contract: drop app pages, /mcp, the OAuth redirect and
    // framework-internal /api/_* routes (auth-utils session, icon proxy).
    const paths = Object.fromEntries(
        Object.entries(structuredClone(rawSpec.paths))
            .filter(
                ([path]) =>
                    path.startsWith('/api/') && !path.startsWith('/api/_'),
            )
            .toSorted(([a], [b]) => a.localeCompare(b)),
    )

    const incomplete = []
    for (const operations of Object.values(paths)) {
        for (const operation of Object.values(operations)) {
            // Nitro auto-derives a string-typed path parameter from the route
            // pattern; when a route meta declares the same (name, in) pair,
            // the described meta one wins regardless of which order Nitro
            // emitted them in.
            const byKey = new Map()
            for (const param of operation.parameters ?? []) {
                const key = `${param.in} ${param.name}`
                const kept = byKey.get(key)
                if (!kept || (!kept.description && param.description)) {
                    byKey.set(key, param)
                }
            }
            operation.parameters = [...byKey.values()]

            const missingMeta = []
            if (!operation.operationId) missingMeta.push('operationId')
            const documented = Object.entries(operation.responses ?? {}).some(
                ([status, response]) =>
                    /^2\d\d$/.test(status)
                    && (status === '204' || response?.content),
            )
            if (!documented) missingMeta.push('responses')
            if (missingMeta.length) {
                incomplete.push(
                    `${JSON.stringify(operation.tags)} ${operation.summary ?? '(no summary)'} lacks ${missingMeta.join(', ')}`,
                )
            }
        }
    }
    if (incomplete.length) {
        throw new Error(['Route meta incomplete:', ...incomplete].join('\n  '))
    }

    return {
        openapi: rawSpec.openapi,
        info: { ...rawSpec.info, version },
        paths,
        components,
    }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    const { Validator } = await import('@seriousme/openapi-schema-validator')

    const BASE = process.env.BASE_URL ?? 'http://localhost:4004'
    const ROOT = new URL('..', import.meta.url)
    const OUT = new URL('openapi/kilorep.json', ROOT)

    const res = await fetch(`${BASE}${OPENAPI_ROUTE}`).catch(() => null)
    if (!res?.ok) {
        console.error(
            `Could not read ${BASE}${OPENAPI_ROUTE} — is the dev server running?`,
        )
        process.exit(1)
    }
    const spec = await res.json()

    const components = JSON.parse(
        readFileSync(new URL('openapi/components.json', ROOT), 'utf8'),
    )
    const pkg = JSON.parse(readFileSync(new URL('package.json', ROOT), 'utf8'))

    let document
    try {
        document = buildDocument(spec, components, pkg.version)
    } catch (error) {
        console.error(error.message)
        process.exit(1)
    }

    const validator = new Validator()
    const result = await validator.validate(structuredClone(document))
    if (!result.valid) {
        console.error('OpenAPI document invalid:')
        console.error(JSON.stringify(result.errors, null, 2).slice(0, 4000))
        process.exit(1)
    }

    // The validator checks document structure but not $ref reachability across
    // our merged components — walk them explicitly so a typo can't land.
    const refs = new Set()
    const walk = (node) => {
        if (Array.isArray(node)) return node.forEach(walk)
        if (node && typeof node === 'object') {
            if (typeof node.$ref === 'string') refs.add(node.$ref)
            Object.values(node).forEach(walk)
        }
    }
    walk(document)
    const dangling = [...refs].filter(
        (r) =>
            !r.startsWith('#/components/schemas/')
            || !components.schemas[r.slice('#/components/schemas/'.length)],
    )
    if (dangling.length) {
        console.error(`Dangling $refs: ${dangling.join(', ')}`)
        process.exit(1)
    }

    writeFileSync(OUT, JSON.stringify(document, null, 4) + '\n')
    console.log(
        `Wrote ${OUT.pathname} — ${Object.keys(document.paths).length} paths, ${Object.keys(components.schemas).length} schemas, v${pkg.version}`,
    )
}
