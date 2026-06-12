/**
 * Native-app sign-in (ADR-0002): exchanges a Google ID token, obtained
 * on-device via Credential Manager, for a long-lived device token minted from
 * the same table as the MCP tokens — so it shows up in web settings and is
 * revocable per device. Identity is provider + `sub`, the same rule as the
 * web OAuth flow. 404s on single-user instances: there is no Google client
 * to validate an audience against, and no account to sign in to.
 */
export default defineEventHandler(async (event) => {
    requireAuthMode()
    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    if (typeof body.idToken !== 'string' || !body.idToken) {
        badRequest('idToken is required')
    }

    const identity = await verifyGoogleIdToken(body.idToken)
    const user = findOrCreateGoogleUser(identity)
    return createApiToken(user.id, body.deviceName)
})
