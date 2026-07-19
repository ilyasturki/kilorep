// What is actually deployed here: the released version and the commit it was
// built from. Public and unauthenticated so a deploy can be verified from
// outside, which is the whole point of it.
//
// Under /api/_ deliberately: scripts/export-openapi.mjs drops those paths, so
// this stays out of the contract the Android client is generated from. It is an
// operational probe, not part of the app's API.
export default defineEventHandler(() => {
    const config = useRuntimeConfig()
    return {
        version: config.public.appVersion,
        rev: config.gitRev,
    }
})
