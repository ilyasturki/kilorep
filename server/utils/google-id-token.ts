import { createRemoteJWKSet, jwtVerify } from 'jose'

/** The identity claims device sign-in resolves an account by (ADR-0002). */
export type GoogleIdentity = {
    sub: string
    email?: string
    name?: string
    picture?: string
}

// Keyed by URL so a test instance pointing NUXT_GOOGLE_JWKS_URL at its own
// mock server gets its own set. jose caches the keys and refetches on an
// unknown kid, so a rotated-out Google key can never be served stale; the
// timeout keeps a slow Google from hanging this unauthenticated endpoint.
const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>()

function remoteJwks(url: string) {
    let jwks = jwksByUrl.get(url)
    if (!jwks) {
        jwks = createRemoteJWKSet(new URL(url), { timeoutDuration: 5000 })
        jwksByUrl.set(url, jwks)
    }
    return jwks
}

/**
 * Verifies a Google ID token (signature against the configured JWKS source,
 * issuer, audience = our OAuth client ID, RS256 pinned) and returns its
 * identity claims. Any verification failure — including a JWKS fetch failure
 * — is a 401, never a 500: this endpoint is unauthenticated.
 */
export async function verifyGoogleIdToken(
    idToken: string,
): Promise<GoogleIdentity> {
    const config = useRuntimeConfig()

    let payload
    try {
        payload = (
            await jwtVerify(idToken, remoteJwks(config.googleJwksUrl), {
                algorithms: ['RS256'],
                issuer: ['https://accounts.google.com', 'accounts.google.com'],
                audience: config.oauth.google.clientId,
            })
        ).payload
    } catch {
        unauthorized('Invalid ID token')
    }

    if (!payload.sub) unauthorized('Invalid ID token')
    return {
        sub: payload.sub,
        email: typeof payload.email === 'string' ? payload.email : undefined,
        name: typeof payload.name === 'string' ? payload.name : undefined,
        picture:
            typeof payload.picture === 'string' ? payload.picture : undefined,
    }
}
