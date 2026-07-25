# Stack

Decided 2026-07-25. Judged against the locked criteria below, in their stated priority order.

The one criterion argument could not settle — whether a WebView can reach best-in-class mobile polish — was settled by evidence instead: an APK teardown of Alpha Progression on this phone, the single competitor mobile UI judged best-in-class in the whole audit, and a WebView. Full breakdown in [COMPETITORS.md](COMPETITORS.md#alpha-progression).

v1's stack mistake — a second native codebase with a dev loop so painful that changes stopped being tested — is now structurally impossible: there is one client bundle, and it is the same bytes in Chrome and on the phone.

## Locked criteria

In priority order:

1. **Ease of development and direct testability.** Instant feedback on desktop (HMR or equivalent), and Claude must be able to see and test changes directly (Claude-in-Chrome for web surfaces, or an equivalent for the mobile surface).
2. **Best-in-class mobile ceiling.** The mobile app must be able to reach first-in-class polish for the fitness-data segment. No "feels like an afterthought" compromise.
3. **One codebase, phone + web both first-class.**
4. **Extreme offline.** Local-first workout domain, opportunistic sync.

Notes:

- v1 expertise (Vue/Nuxt) carried zero weight, as intended: the rule existed to stop familiarity winning the renderer fight, and the renderer won on criteria instead. It was **not** re-applied inside the winning family — see the framework choice below.
- Two codebases is disqualified by definition.

## The stack

| Layer | Choice |
|---|---|
| Platform | Android now. iOS is a build-target flip, never a rewrite — but zero iOS work, no Mac, no Apple account in v1. |
| Renderer | Web UI in a **Capacitor** WebView. The same DOM ships to Chrome and to the phone. |
| Framework | **Svelte 5** (runes), **Bits UI** primitives. |
| App shape | **One SvelteKit app.** `adapter-static` + `fallback` builds the Capacitor bundle; `adapter-node` builds the server, which also hosts the SPA. |
| Local store | **In-memory domain, IndexedDB persistence.** Identical API in Chrome and the WebView. |
| Sync | **Watermark with server-assigned `seq`.** Device-generated uuid, `updatedAt`, `deletedAt` tombstone. Last-write-wins per record. |
| Server | **SQLite + Drizzle**, `adapter-node`, one container. Multi-tenant: `userId` on every row, v1's shape carried forward. |
| Auth | **Local credentials only.** Session cookie on web; a long-lived hashed device token for the APK, the REST API and MCP. No OAuth, no passkeys. |
| Distribution | **Direct signed APK** (v1's keystore). Play and F-Droid deferred, both kept open. |
| Design pipeline | **No bundle, no React mirror.** Design freeform in claude.ai/design, then author the system in Svelte. |

Verified locally before committing to the app shape (svelte 5.56.8, kit 2.70.1, adapter-static 3.0.10): with `fallback` set, `adapter-static` compiles `+server.js` endpoints and silently omits them from the static output. The build succeeds. One tree, two adapters, no route juggling.

## Why the renderer

Criteria 1, 3 and 4 all point the same way, and 2 was the only counterweight until the teardown removed it.

- **Criterion 1.** Under Capacitor the browser surface and the phone surface are the same artifact. Claude edits, verifies in Chrome, and attaches to the WebView on the real phone over adb — the shipped surface, not a proxy. Under Expo, Claude can read RN-Web, which is not what goes to the gym. Under Flutter, Claude reads nothing: the HTML renderer was removed, canvaskit and skwasm paint to a `<canvas>` with no DOM, and the parallel semantics tree is not page content.
- **Criterion 3.** "Both first-class" is structurally true only here — one bundle, one DOM. RN-Web is a port with its own bug surface: v1's drift pattern moved inside one repo. Flutter Web is not a web surface in any sense a planning-and-review desktop app needs. Note what the teardown showed: this stack hands you criterion 3 nearly free, and the leading competitor simply declines to take it.
- **Criterion 4.** With local-first on both surfaces (decided: the browser runs the same store and sync as the phone), IndexedDB is the same API in Chrome and the WebView — the same code, zero divergence. Expo would mean two SQLite backends; Flutter, native drift versus sqlite3-wasm.
- **Criterion 2.** Alpha Progression clears the bar with jQuery 3.7.1, hand-written CSS and no UI framework at all. The ceiling is set by craft, not by the renderer.

And this app is close to the best case for a WebView. The classic weaknesses are gesture physics, native transitions and system-keyboard behaviour; [PRODUCT.md](PRODUCT.md) designs the keyboard out of the loop (custom numpad, fat ± steppers), and the workout screen is dense, static and big-tap-target — not a gesture showcase.

**Ranking, for the record:** Capacitor first. Expo a real second — the answer if native feel turns out to matter more than testability. Flutter third. Tauri mobile last: Capacitor's plugin surface *is* the list Alpha bought its native feel with.

## Why not PouchDB

Alpha's local store is the obvious thing to copy and it was rejected deliberately. Their PouchDB replicates to **IBM Cloudant** — managed CouchDB, endpoint hard-coded in the bundle — so what looks like a free sync engine is free only if you run CouchDB. Kilorep's server is SQLite in one container, by [VISION.md](VISION.md)'s self-hosting thesis. Adopting PouchDB would mean either standing up CouchDB alongside it or writing the sync anyway, plus inheriting a revision-tree conflict model when [PRODUCT.md](PRODUCT.md#offline-behavior) already settled on last-write-wins per record. Right answer to a question kilorep is not asking.

The same reasoning refuses ElectricSQL and PowerSync, and there the cost is documented rather than predicted: wger took that road, and [COMPETITORS.md](COMPETITORS.md#wger) records the result — a second distributed-systems product, an extra container that crash-loops out of the box, cron-scheduled compaction.

## Why Svelte

Chosen over Vue on motion and weight. `transition:` / `animate:` / spring primitives are built into the language, and the polish tax is paid in motion; the runtime is the smallest of the candidates, which is real on a mid-range Android WebView. It is also the cheapest port target from design-tool output, because Svelte markup *is* HTML — no JSX, no `className`, no template dialect.

Its one serious risk is criterion-1-shaped: training-data skew toward Svelte 4 idioms, since runes were a hard API break. That is mitigated by the standing rules below rather than hoped away.

## Standing rules

Committed to `CLAUDE.md`; repeated here because they are stack decisions, not conventions.

- **The domain, store and sync layer is plain TypeScript with zero framework imports.** This is what keeps a future migration cheap and what lets `bun test` cover the parts that matter.
- **Runes only.** No `export let`, no `$:`, no stores inside components, no slots.
- **Never answer a Svelte or SvelteKit API question from memory** — query context7 `/llmstxt/svelte_dev_llms_txt` first.
- **One `apiBase`**: `location.origin` on web, unconfigured in the shell until a server is connected. Never a bare relative `/api/…` — it works on web and 404s in the APK, where the origin is `capacitor://localhost` and the endpoint was omitted from the build.
- **`ssr = false` and `prerender = false` globally, permanently.** One stray `+page.server.js` breaks the APK build, and not loudly.
- **No proprietary SDKs, ever.** No Firebase, no RevenueCat — exactly what Alpha ships and what [VISION.md](VISION.md)'s posture refuses. This is also what keeps F-Droid available whenever it is wanted.

## Verification loop

Criterion 1, made operational.

- **Chrome is primary.** Device-sized viewport, DOM reads, clicks, assertions — for the ~90% of changes that are logic and layout.
- **The phone is mandatory** — a change is not done until verified on device — for anything touching: a Capacitor plugin, scroll or gesture, safe-area insets, motion timing, or the workout screen's feel. That list is the polish tax, made non-optional.
- **Mechanism.** `adb reverse` tunnels the Vite dev server to the phone, so the WebView hits `localhost` and HMR runs on the device with no LAN dependency. Carried from v1's `android/justfile`.
- **Android SDK on NixOS.** `androidenv.composeAndroidPackages`, carried verbatim from v1's `android/nix/sdk.nix` — nixpkgs patches the prebuilt Google binaries (notably aapt2) that will not otherwise run.
- **Tests.** `bun test` against the framework-free core: domain math, sync, store.

## Accepted costs

Written down so they cannot be discovered later as surprises.

- **The polish tax is an obligation, not a hope.** Alpha bought its native feel with plugin work — safe-area, navigation bar, haptics, keep-awake — and 52 hand-authored keyframes. Unpaid, a WebView will feel exactly like v1's neglected Android app felt. This is the one risk that can still sink the choice, and it is a discipline risk, not a technical one.
- **The rest timer is on-screen only, permanently** (see [PRODUCT.md](PRODUCT.md#the-in-gym-loop-set-by-set)). Kilorep is the only app in its own threat matrix with no off-screen rest signal. Consequence: **keep-awake is load-bearing**, not cosmetic — the screen must not sleep mid-workout.
- **Multi-tenancy is built now, for later.** `userId` on every row, auth flows and an accounts surface exist for a v1 user count of one, so that a hosted instance is a deploy rather than a migration.

## Open

- Whether the Claude-in-Chrome tooling attaches to a remote WebView target over adb. Untested — no device connected at decision time. Fallback is driving CDP directly over `adb forward`, so the capability stands either way. First-week check.
- Whether Bits UI's primitives earn their place: this app is mostly steppers and lists, and the component value is modest. Kept for now because it holds correct modern runes code in context.
