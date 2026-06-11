Workout session manager for gym and weight tracker. Simple and minimalist, no fioriture.

# Stack

- Nuxt 4, Vue 3, TypeScript
- Tailwind CSS 4
- Bun as package manager
- UI components : reka-ui (Lift design system — tokens + component classes in app/assets/css/main.css, ui wrappers in app/components/ui)
- hosted on nixos vps
- (later) native android mobile app that will use the nitro backend

# Dev server

A dev server is usually already running on http://localhost:4004. To verify changes, reuse it (HMR has already picked up edits) — `curl localhost:4004` or open it in the browser. Do NOT kill the process on port 4001 or start a competing `nuxt dev`. If you need an isolated instance, start one on a different port with `NUXT_IGNORE_LOCK=1` (e.g. `NUXT_IGNORE_LOCK=1 nuxt dev --port 4099`).

# Auth modes

Multi-user mode turns on iff `NUXT_OAUTH_GOOGLE_CLIENT_ID`/`_CLIENT_SECRET` are set (plus `NUXT_SESSION_PASSWORD`); without them the app runs single-user as an implicit local account — there is no separate flag. Every data query is scoped by a required `userId` argument resolved by `server/middleware/auth.ts`. The isolation backstop is `bun run test:isolation` against an auth-mode instance (see the header of tests/isolation.test.mjs for the exact env). `bun run dev:solo` starts a single-user instance from `.env.solo` (gitignored — copy .env.example and use a separate DB_FILE_NAME; the script refuses to start without the file).

# Code quality

Comments explain _why_, never _what_. Only add a comment when the rationale is non-obvious (a gotcha, a timing constraint, a security trade-off). Do not add comments that restate what the code or option names already make clear.
