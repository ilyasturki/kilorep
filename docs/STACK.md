# Stack

The decision is deferred until the finalists are prototyped. It is decided by evidence, not opinion: v1's stack mistake (a second native codebase with a dev loop so painful that changes stopped being tested) must not repeat.

## Locked criteria

In priority order:

1. **Ease of development and direct testability.** Instant feedback on desktop (HMR or equivalent), and Claude must be able to see and test changes directly (Claude-in-Chrome for web surfaces, or an equivalent for the mobile surface).
2. **Best-in-class mobile ceiling.** The mobile app must be able to reach first-in-class polish for the fitness-data segment. No "feels like an afterthought" compromise.
3. **One codebase, phone + web both first-class.**
4. **Extreme offline.** Local-first workout domain, opportunistic sync.

Notes:

- v1 expertise (Vue/Nuxt) carries zero weight. Total rewrite regardless of choice.
- Two codebases is disqualified by definition.

## Candidates

To narrow to two finalists. For each: dev loop, Claude testability, mobile ceiling, web story, offline story.

- Web SPA + native shell (Capacitor or Tauri mobile):
  - Existence proof for criterion 2. **Alpha Progression is this stack** — Capacitor + vanilla JS/jQuery + PouchDB, verified by APK teardown 2026-07-25 (full breakdown in [COMPETITORS.md](COMPETITORS.md#alpha-progression)). It is the one competitor mobile UI judged best-in-class in the whole audit, and it is a WebView. It clears that bar with jQuery 3.7.1, hand-written CSS and Chart.js 2.9.3 — no UI framework at all.
  - What that implies: the mobile ceiling is set by craft, not by the renderer. Their polish comes from plugin work (safe-area, navigation-bar, haptics, keep-awake) and 52 hand-authored keyframes — both available to any web stack. "WebView therefore afterthought" is now disproven by the app on this phone.
  - Offline: their local store is PouchDB on IndexedDB — a local-first document store with replication built in, worth evaluating for criterion 4. Sync target is not visible from the bundle (Firebase Functions present, so not necessarily stock CouchDB).
  - Still unproven here: criteria 1 and 3. Alpha Progression says nothing about dev loop, and it ships no web surface despite being a web app — so the phone+web parity claim remains to be earned by prototype.
- Flutter:
- Expo / React Native:
- Other:

## Prototype protocol

Build the same throwaway prototype in each finalist: the workout screen, with fake data, logging a set and moving through a session. Install both on the real phone. Judge with hands, at arm's length, thumb only.

- Finalist A:
- Finalist B:
- What each felt like on the phone:
- Dev-loop experience while building each:

## Verdict

-
