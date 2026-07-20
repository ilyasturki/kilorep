/**
 * Syncs package.json's version into the other files that carry it:
 *
 * - openapi/kilorep.json info.version — the committed contract pins the
 *   version, but the drift gate rebuilds it from package.json, so a bare
 *   `npm version` bump drifts the two and reds CI. (Route/schema drift is
 *   caught separately against a live instance; no dev server needed here.)
 * - android/app/build.gradle.kts versionName/versionCode — the release
 *   workflow ships an APK for every v* tag, so the tagged commit must
 *   already carry the matching Android version. versionCode packs the
 *   semver as major*1_000_000 + minor*10_000 + patch, monotonic as long
 *   as minor and patch stay below 100.
 *
 * Run from the `version` lifecycle script.
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

const [major, minor, patch] = version.split('.').map(Number)
if ([major, minor, patch].some(Number.isNaN) || minor >= 100 || patch >= 100) {
    throw new Error(`Cannot pack "${version}" into a monotonic versionCode`)
}
const versionCode = major * 1_000_000 + minor * 10_000 + patch

const gradleUrl = new URL('android/app/build.gradle.kts', root)
const gradle = readFileSync(gradleUrl, 'utf8')
const synced = gradle
    .replace(/versionCode = \d+/, `versionCode = ${versionCode}`)
    .replace(/versionName = "[^"]*"/, `versionName = "${version}"`)
if (
    !synced.includes(`versionCode = ${versionCode}`)
    || !synced.includes(`versionName = "${version}"`)
) {
    throw new Error('versionCode/versionName not found in build.gradle.kts')
}
if (synced !== gradle) {
    writeFileSync(gradleUrl, synced)
    console.log(
        `Synced android versionName to ${version} (versionCode ${versionCode})`,
    )
}
