/**
 * Syncs openapi/kilorep.json's info.version to package.json's version.
 *
 * The committed contract pins the version, but the drift gate rebuilds it
 * from package.json — so a bare `npm version` bump drifts the two and reds
 * CI. Run from the `version` lifecycle script, this re-syncs the one field a
 * bump can change (route/schema drift is caught separately against a live
 * instance), so no dev server is needed here.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('..', import.meta.url)
const { version } = JSON.parse(
    readFileSync(new URL('package.json', root), 'utf8'),
)
const specUrl = new URL('openapi/kilorep.json', root)
const spec = JSON.parse(readFileSync(specUrl, 'utf8'))

if (spec.info.version !== version) {
    spec.info.version = version
    writeFileSync(specUrl, JSON.stringify(spec, null, 4) + '\n')
    console.log(`Synced openapi/kilorep.json version to ${version}`)
}
