/**
 * Native-app sign-in: exchanges a Google ID token, obtained
 * on-device via Credential Manager, for a long-lived device token minted from
 * the same table as the MCP tokens — so it shows up in web settings and is
 * revocable per device. Identity is provider + `sub`, the same rule as the
 * web OAuth flow. 404s on single-user instances: there is no Google client
 * to validate an audience against, and no account to sign in to.
 */
defineRouteMeta({
    openAPI: {
        operationId: 'deviceSignIn',
        tags: ['auth'],
        summary: 'Exchange a Google ID token for a long-lived device token',
        requestBody: {
            required: true,
            content: {
                'application/json': {
                    schema: {
                        $ref: '#/components/schemas/DeviceSignInInput',
                    },
                },
            },
        },
        responses: {
            '200': {
                description:
                    'The device token, revocable from web settings like any API token.',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/TokenGrant' },
                    },
                },
            },
            '400': {
                description: 'Missing idToken or token limit reached.',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ApiError' },
                    },
                },
            },
            '401': {
                description: 'ID token verification failed.',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ApiError' },
                    },
                },
            },
            '404': {
                description:
                    'Single-user instance: device sign-in does not exist.',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/ApiError' },
                    },
                },
            },
        },
    },
})

export default defineEventHandler(async (event) => {
    requireAuthMode()
    const body = (await readBody<Record<string, unknown>>(event)) ?? {}
    if (typeof body.idToken !== 'string' || !body.idToken) {
        badRequest('idToken is required')
    }

    const identity = await verifyGoogleIdToken(body.idToken)
    const user = findOrCreateGoogleUser(identity)
    // Reinstall/re-onboard signs in again under the same device name; rotate
    // that device's token instead of stacking rows toward the limit.
    deleteApiTokensByLabel(user.id, body.deviceName)
    return createApiToken(user.id, body.deviceName)
})
