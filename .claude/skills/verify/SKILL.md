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

- Login form: fill email + password inputs, press Enter, `waitForURL('**/start')`.
- Steppers are labeled `increase kg` / `increase reps` (2.5 kg and 1 rep per tap, from 0).
- The commit button's text is `Log set` when live, `Enter a weight to log` when inert.
- Two finish buttons exist when the session is done: header `FINISH` and empty-state
  `Finish` — always use `{ exact: true }` or strict mode throws.
- `main` scoping matters: sheets/overlays leave hidden twins of buttons in the DOM.
- Inspect the client store from the page: `indexedDB.open('kilorep', 1)`, stores
  `records` (sync envelope + `dirty`) and `meta` (`watermark`, `active-session`, `owner`).
- The write-triggered sync debounce is 3s — wait ~4.5s after FINISH before asserting
  `dirty: false` or checking the server.
