# kilorep

The workout tracker that is actually yours, and faster in the gym than anything else. Local-first, open source, self-hostable.

Read the docs before changing anything they govern: [VISION](docs/VISION.md) (what and why) · [PRODUCT](docs/PRODUCT.md) (domain model, the in-gym loop, screens) · [DESIGN](docs/DESIGN.md) (character) · [STACK](docs/STACK.md) (every stack decision and its rationale) · [BENCHMARK](docs/BENCHMARK.md) + [COMPETITORS](docs/COMPETITORS.md) (the market bar).

## Stack

One SvelteKit app, two adapters. `adapter-static` + `fallback` → the Capacitor bundle for Android. `adapter-node` → the server, which also hosts the SPA.

Svelte 5 (runes) · Bits UI · Capacitor · in-memory domain over IndexedDB · SQLite + Drizzle server · `bun test`.

Rationale for all of it is in [STACK.md](docs/STACK.md). Do not relitigate a decision recorded there without saying so out loud.

## Hard rules

These are stack decisions, not preferences. Breaking one is a bug.

1. **The domain, store and sync layer imports no framework.** Plain TypeScript. Domain math, sync protocol and persistence must be testable with `bun test` and portable if the UI is ever rewritten.
2. **Runes only.** `$state` / `$derived` / `$props()` / snippets. Never `export let`, never `$:`, never a writable store inside a component, never slots.
3. **Never answer a Svelte or SvelteKit API question from memory.** Query context7 `/llmstxt/svelte_dev_llms_txt` first — runes were a hard API break and training data skews to Svelte 4.
4. **One `apiBase`.** `location.origin` on web; unconfigured in the shell until the user connects a server. **Never a bare relative `/api/…`** — it works on web and 404s in the APK, where the origin is `capacitor://localhost` and server endpoints were omitted from the static build. This bug will not show up in Chrome.
5. **`ssr = false` and `prerender = false` globally, permanently.** One `+page.server.js` or server-dependent `load` breaks the Android build, quietly.
6. **No proprietary SDKs.** No Firebase, no analytics, no RevenueCat. Ever.
7. **Nothing may add friction to the logging loop.** The workout screen answers to that rule alone — see [VISION.md](docs/VISION.md#scope).

## Verifying a change

**Chrome is primary.** Device-sized viewport; read the DOM, click, assert. Covers logic and layout — most changes.

**The phone is mandatory** for anything touching a Capacitor plugin, scroll or gesture, safe-area insets, motion timing, or the workout screen's feel. Those changes are not done until seen on the device. That list is the polish tax and it is not optional: a WebView reaches best-in-class only if the craft is paid for.

```
adb reverse tcp:5173 tcp:5173   # WebView hits localhost — HMR on the phone, no LAN needed
```

Android SDK on NixOS comes from `androidenv.composeAndroidPackages` (nixpkgs patches aapt2 and friends; Google's prebuilt binaries do not run otherwise).

## Things that are easy to get wrong here

- **The rest timer is on-screen only, by decision.** There is no local notification and there will not be one. Because of that, keep-awake is load-bearing — the screen must not sleep mid-workout.
- **The countdown chip is always derived from a stored `startedAt`**, never an accumulating counter. Resuming mid-rest must be exact.
- **Sync is last-write-wins per record**, ordered by a server-assigned `seq`, never by a device clock. Records carry `deletedAt` tombstones — without them, deletes resurrect on the next pull.
- **A finished, synced workout is never clobbered.** Enforced server-side. This is the one sacred guarantee in [PRODUCT.md](docs/PRODUCT.md#offline-behavior).
- **Volume counts completed working sets only.** Warmups never count; uncompleted sets never count. Per-hand and unilateral load modes multiply by 2.
- **The server is optional.** The phone is complete standalone — install, lift, export, forever, with no server. Never write code that assumes one exists.
