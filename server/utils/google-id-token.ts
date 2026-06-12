import type { JSONWebKeySet } from 'jose'
import { createLocalJWKSet, jwtVerify } from 'jose'

/** The identity claims device sign-in resolves an account by (ADR-0002). */
export type GoogleIdentity = {
    sub: string
    email?: string
    name?: string
    picture?: string
}

/**
 * Verifies a Google ID token (signature against the configured JWKS source,
 * issuer, audience = our OAuth client ID, RS256 pinned) and returns its
 * identity claims. Any verification failure is a 401.
 *
 * The JWKS is fetched per call rather than cached: sign-ins happen about once
 * per device install, and a fresh fetch can never hold a rotated-out key.
 */
export async function verifyGoogleIdToken(
    idToken: string,
): Promise<GoogleIdentity> {
    const config = useRuntimeConfig()
    const jwks = await $fetch<JSONWebKeySet>(config.googleJwksUrl)

    let payload
    try {
        payload = (
            await jwtVerify(idToken, createLocalJWKSet(jwks), {
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
