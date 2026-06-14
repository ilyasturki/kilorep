// Public: tells the client whether this instance runs with auth configured,
// so the route middleware can gate the app (or skip gating entirely when
// self-hosted without creds). Exempted from the auth middleware.
defineRouteMeta({
    openAPI: {
        operationId: 'getAuthMode',
        tags: ['auth'],
        summary: 'Probe whether this instance runs with auth configured',
        responses: {
            '200': {
                description:
                    'The auth mode. `false` means single-user: no credential is needed and sign-in endpoints do not exist.',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/AuthMode' },
                    },
                },
            },
        },
    },
})

// The client id is public by nature (the web OAuth redirect carries it); the
// native app needs it as the audience when requesting an ID token on-device.
export default defineEventHandler(() => ({
    authEnabled: authEnabled(),
    googleClientId:
        authEnabled() ? useRuntimeConfig().oauth.google.clientId : null,
}))
