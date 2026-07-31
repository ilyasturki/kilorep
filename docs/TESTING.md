# Testing in a browser

A runbook, not a design document — it does not wind down the way the rest of
`docs/` does. It exists because driving the app through Chrome kept failing at
the sign-in screen for a reason nothing in the tree admitted to.

## The account

```
email     dev@kilorep.local
password  devdevdev
```

Public on purpose, and created by `scripts/seed.ts`, which refuses to run under
`NODE_ENV=production` because these credentials are in the repository. A real
instance gets its first account from `bun run account:create`, which never
touches the network.

**Never guess at these.** Read them here and type them once. Guessing is what
the next section is about.

## Why this used to fail

`/.data` is gitignored, so every worktree gets its own SQLite file — and a
fresh one has no accounts in it at all. The sign-in screen still renders, so
the failure looks like a wrong password rather than an empty database, and the
natural response is to try again.

`src/lib/server/auth/throttle.ts` is counting. Ten failures against one
address and account inside fifteen minutes, and login answers `429 too many
failed attempts`, locking you out of a server whose password you never had.
Fifty failures from the address across all accounts is the wider ceiling, and
nothing clears that one early.

Two things keep it from happening now:

- `.worktreeinclude` at the repo root copies `.data/kilorep.db` and its `-wal`
  into every worktree Claude Code creates, so the account is there before the
  server is.
- If it is not — a worktree made by hand, a database deleted, a torn copy —
  `bun run db:seed` creates it. The script is idempotent and prints
  `already seeded` on a second run.

Check before assuming, it costs nothing:

```sh
bun run account:list
```

If you are already throttled, restart the dev server. The counters are plain
maps in the server process with no persistence, so a restart is the whole
reset.

## Running it

```sh
bun run dev          # http://localhost:5173
```

The Chrome extension needs permission for `localhost:5173` before any of the
`mcp__claude-in-chrome__*` tools will touch the page — that is granted in the
extension, not from here, and it is a one-time thing per site.

Keep the tab you are driving **visible**. A backgrounded tab has
`requestAnimationFrame` frozen, so anything transition-driven — sheets,
overlays, the set-completion animation — is caught mid-flight and screenshots
as broken layout rather than as the bug you were looking for.

## Google sign-in

```sh
bun run dev:google   # http://localhost:5173, with .env.google loaded
```

`.env.google` at the repo root, read by that script and by nothing else — plain
`bun run dev` is untouched, and so are `bun run start`, the container and
drizzle-kit. It ships with `ALLOW_REGISTRATION=1`; fill in the two Google lines.
Missing, the script refuses to start rather than serving a login screen with no
Google button on it.

Nothing here can be diagnosed from the browser, which is why the file exists: an
unconfigured client and a closed instance both answer with a login screen that
draws no Google button, and that looks exactly like a correctly configured one you
are not allowed into. The endpoints under `/api/auth/google` are 404 for the same
reason — a self-hosted instance with no identity provider has nothing to say about
one. Half a client is the same as none; it resolves whole or not at all.

`ALLOW_REGISTRATION` belongs in this file and never in `.env`, which `bun run
start` and the container also read. It is needed because the first Google sign-in
is a *creation*: the seeded account is `dev@kilorep.local`, which is nobody's
Google address, so there is nothing for the identity to link to. Closed, the
callback redirects back to `/login` with a refusal rather than failing — the one
case here that does explain itself.

Then, in the Cloud console:

- the Authorized redirect URI must be `http://localhost:5173/api/auth/google/callback`
  exactly. A mismatch fails on Google's own page as `redirect_uri_mismatch`,
  before this server sees the request again.
- while publishing status is "Testing", only the addresses listed as test users
  can sign in. Your own is not there by default.

`http` on localhost needs no `ORIGIN`: `secureCookies` reads the request's scheme,
so the handshake cookie goes out without `Secure` and the browser keeps it.

After a successful run, `bun run account:list` shows the new account beside the
seeded one. `bun run account:delete you@gmail.com` puts you back to testing the
creation path from empty.

## The three states

**Signed in.** Sign in through the form at `/login`; that is the flow worth
exercising and the one place a real user's typing is reproduced. When the
session is only setup for something else, `POST /api/auth/login` with
`{"email":…,"password":…,"client":"web"}` sets the same HttpOnly cookie without
any typing to get wrong.

**Signed out.** `POST /api/auth/logout` revokes the credential the request
arrives with and clears the cookie. Then load any route under `(app)` and the
layout's guard should bounce you to
`/login?redirectTo=<the%20url%20you%20asked%20for>`, and signing in should land
you back on that URL rather than on Start. The reverse holds too: `/login` with
a good cookie redirects out, honouring `redirectTo` if it carries one.

Logging out is per credential by design — the browser signing out must not end
a workout on the phone. So a token issued to another device survives it, and
that is the correct result, not a leak.

**No server.** Not reachable in Chrome. `apiBase()` answers `location.origin`
on the web and `null` only in the app build, and it is `null` that the guards
read as local-only rather than signed-out. Testing that branch means the APK,
or a unit test against `setApiBase(null)`.
