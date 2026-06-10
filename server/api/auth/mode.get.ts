// Public: tells the client whether this instance runs with auth configured,
// so the route middleware can gate the app (or skip gating entirely when
// self-hosted without creds). Exempted from the auth middleware.
export default defineEventHandler(() => ({ authEnabled: authEnabled() }))
