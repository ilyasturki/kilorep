# Decisions

## Rejected — do not relitigate

- **Expo / React Native** (2026-07-25) — RN-Web is not what ships to the gym, and offline would mean two SQLite backends. The real second choice if native feel ever outweighs testability.
- **Flutter** (2026-07-25) — canvaskit paints to a `<canvas>`: no DOM to read, click or assert against, on either surface.
- **Tauri mobile** (2026-07-25) — Capacitor's plugin surface *is* the list Alpha Progression bought its native feel with.
- **PouchDB** (2026-07-25) — its free sync engine is free only if you run CouchDB. Same reasoning refuses ElectricSQL and PowerSync; wger took that road and pays for it with an extra crash-looping container and cron-scheduled compaction.
- **Vue / Nuxt** (2026-07-25) — no motion primitives in the language, larger runtime on a mid-range Android WebView. v1 expertise carried zero weight on purpose.
- **Hand-written CSS over Tailwind** (2026-07-25) — utilities did not win on quality (Alpha clears the bar with 169 KB of hand-written CSS and no framework). They won on the pipeline: design returns Tailwind-shaped markup, and hand-written CSS means hand-translating every return, forever.
- **`bun test`** (2026-07-27) — the server's driver is the `node:sqlite` builtin, which does not exist under Bun, so it cannot execute a line of server code.
- **Quicksand, Varela Round, Comfortaa, Baloo 2** (2026-07-25) — geometric and weak at small sizes / one weight only / legibility / display personality.

## Open

- **The Capacitor entry must be `/start`, not `/`.** The landing page owns `/`, so the shell hydrates and its router resolves to the pitch. Deferred until Capacitor is actually installed — a fix written today would key off nothing. Blocks the first APK.
- **Drizzle is pinned to `1.0.0-rc.4`**, orm and kit both, exact — a mismatched pair fails with `SQLiteSyncDialect is not a constructor`. The `node:sqlite` driver exists only on the 1.0 line. Unpin to a normal range when 1.0 ships.
- **Whether Claude-in-Chrome attaches to a remote WebView over adb.** Untested. Fallback is driving CDP directly over `adb forward`.
