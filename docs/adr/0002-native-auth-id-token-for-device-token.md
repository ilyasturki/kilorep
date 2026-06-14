# Native app auth: Google ID token exchanged for a long-lived device token

The native Android app signs in with the platform-idiomatic Credential Manager
API (using the existing Google web client ID as `serverClientId`), which yields
a Google ID token on-device — no Custom Tab redirect dance. A new endpoint
verifies the ID token against Google's JWKS (audience = our client IDs) and
resolves the user by the same identity rule as the web flow (`provider` +
Google `sub`, never email). It responds with a long-lived opaque device token
minted from the existing `api_tokens` table (label = device name), and bearer
auth is extended from `/mcp` to all of `/api/*`.

## Considered Options

- **Custom Tab through the web OAuth flow** — rejected: clunkier UX than the
  OS account picker, and returning a credential through a deep-link redirect
  needs a one-time-code exchange to avoid token leakage.
- **JWT access + refresh rotation** — rejected: issuance/refresh machinery is
  ceremony without benefit for a single-tenant personal app; per-device
  revocation from web settings covers the stolen-token case.
- **Storing the sealed session cookie** — rejected: 30-day forced re-login and
  fragile cookie plumbing in a native HTTP stack.

## Consequences

- Single-user (self-hosted, no OAuth) instances need no credential at all: the
  app probes `/api/auth/mode` and skips sign-in; the server middleware resolves
  the implicit local account, as it already does for browsers.
- Extending bearer auth to `/api/*` widens the attack surface the isolation
  suite must cover — `test:isolation` needs bearer-path cases, not just
  sealed-cookie ones.
- The ID-token verification endpoint must be disabled in single-user mode
  (there is no Google client to validate an audience against).
- Bearer tokens are scoped out of `/api/account/*` (403): per-device
  revocation only contains a stolen token if that token cannot mint sibling
  tokens that survive its own revocation, or delete the account. Account and
  token management remain session-cookie-only.
