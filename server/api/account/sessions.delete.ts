// "Sign out my other browsers." Stamps a revocation cut-off on the user, which
// middleware/1.session-revocation enforces against every session's loggedInAt,
// then re-issues this browser's cookie so the device doing the revoking is the
// one that stays signed in. Auth mode only: a single-user instance has no
// sessions to revoke. Device tokens are deliberately untouched — each is listed
// and revocable on its own row, so losing a phone doesn't mean losing the web.
defineRouteMeta({
    openAPI: {
        operationId: 'revokeSessions',
        tags: ['account'],
        summary: 'Sign out every other browser session',
        responses: {
            '200': {
                description:
                    'Other sessions revoked; the calling browser stays signed in.',
                content: {
                    'application/json': {
                        schema: { $ref: '#/components/schemas/Ok' },
                    },
                },
            },
            '404': {
                description:
                    'Single-user instance: there are no sessions to revoke.',
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
    const userId = requireUserId(event)

    useDrizzle()
        .update(tables.users)
        .set({ sessionsRevokedAt: new Date().toISOString() })
        .where(eq(tables.users.id, userId))
        .run()

    // Equal timestamps survive the middleware's `>=`, so re-issuing in the same
    // millisecond as the cut-off is safe.
    const { user } = await requireUserSession(event)
    await startSession(event, user)

    return { ok: true }
})
