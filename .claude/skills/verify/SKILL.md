---
name: verify
description: Build, launch and drive kilorep for runtime verification — dev server with isolated DB, headless chromium via playwright-core, curl against the API.
---

# Verifying kilorep at runtime

## Launch

```bash
# Isolated DB so verification never touches real data. Same path for both commands.
export DATABASE_PATH=$SCRATCH/verify.db
printf '%s' 'verify-password-123' | bun run account:create verifier@kilorep.test
DATABASE_PATH=$SCRATCH/verify.db bun run dev -- --port 4599 --strictPort   # background
curl -s http://localhost:4599/api/health   # 200 = up; migrations ran on boot
```

## The dev server does not reload in a worktree

`vite.config.ts` sets `server.watch.ignored: ['**/.claude/**']`, and Claude Code's
worktrees live at `<repo>/.claude/worktrees/<name>` — so **every** file in the tree
you are editing is ignored by the watcher. Nothing hot-reloads, and nothing warns
you: the browser keeps serving the bundle from whenever the server started.

An edit verified against a stale bundle looks exactly like a fix that did not work.
Restart the server after every source change:

```sh
# kill the vite process, then
BUILD_TARGET=app bunx vite dev --port 5188 --strictPort --force
```

## Settings, and anything else the phone owns, needs the app build

`ServerSection` — server address, sign-in, the sync row — renders only under
`import.meta.env.APP_BUILD`, so it is absent from `bun run dev`. Drive it the way the
phone does, with two servers: the API on one port and the app bundle on another,
pointed at it.

```sh
DATABASE_PATH=$SCRATCH/verify.db bunx vite dev --port 4611 --strictPort            # API
BUILD_TARGET=app DEFAULT_SERVER=http://localhost:4611 \
  bunx vite dev --port 5188 --strictPort                                           # app
```

CORS is already handled (`src/lib/server/http/cors.ts`), so the cross-origin pair
works. In the app build `apiBase()` is null until a server is named, so the browser
starts signed out and unconfigured — exactly the state a fresh install is in. Sign in
through Settings; `DEFAULT_SERVER` puts the address behind the "Sign in to …" row.

Two profiles under separate `launchPersistentContext` directories are two phones on
one account, which is how sync convergence gets tested.

## Simulating a network without touching the servers

`page.route('**/api/sync', r => r.abort('connectionrefused'))` is a server that stopped
answering; `route.fulfill({ status: 401 })` is a credential that stopped working.
`page.unroute` puts it back, and the client heals on its own from there. Faster and
more precise than stopping a process, and it leaves the other server's traffic alone.

## API surface

Login needs `client`: `POST /api/auth/login {email, password, client: "web"}` → 204 + cookie
(`curl -c jar.txt` … then `-b jar.txt`). `/api/sync` and friends 401 without it.

## Browser surface

The claude-in-chrome extension may be disconnected. System chromium + playwright-core works
headless and is enough:

```bash
mkdir driver && cd driver && bun add playwright-core
```

```js
import { chromium } from 'playwright-core';
const context = await chromium.launchPersistentContext('<scratch>/driver/profile', {
	headless: true,
	executablePath: '/home/yasso/.local/state/nix/profile/bin/chromium'
});
```

- **Persistent context is load-bearing**: IndexedDB and the session cookie survive across
  separate script runs, so each step can be its own short script — and a fresh launch per
  script doubles as an app-kill test for resume.
- Phone viewport: `page.setViewportSize({ width: 420, height: 860 })`.

## Driving the workout screen

- Login form: fill email + password inputs, press Enter, `waitForURL('**/train')` — `AFTER_LOGIN`.
- Steppers are labeled `increase kg` / `increase reps` (2.5 kg and 1 rep per tap, from 0).
- The commit button's text is `Log set` when live, `Enter a weight to log` when inert.
- Two finish buttons exist when the session is done: header `FINISH` and empty-state
  `Finish` — always use `{ exact: true }` or strict mode throws.
- `main` scoping matters: sheets/overlays leave hidden twins of buttons in the DOM.
- Inspect the client store from the page: `indexedDB.open('kilorep', 1)`, stores
  `records` (sync envelope + `dirty`) and `meta` (`watermark`, `active-session`, `owner`).
- The write-triggered sync debounce is 3s — wait ~4.5s after FINISH before asserting
  `dirty: false` or checking the server.
