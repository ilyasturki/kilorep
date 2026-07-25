# Competitors: the differentiator audit

Companion to [BENCHMARK.md](BENCHMARK.md), which tears down the in-workout loop. This doc audits each competitor on the axes kilorep competes on: where the paywall cuts, offline behavior, data-out, progression model, platform. Ends with the threat matrix.

A competitor is here because it passes the menace test: it sets the loop bar, or it attacks a kilorep differentiator (data ownership / smarter next session).

Evidence: deep desk research 2026-07-24 (official docs, app-store listings, reviews, source code for the open-source ones) plus hands-on web runs where a web app exists. Estimates marked `~`. Full research notes archived outside the repo; this doc keeps the conclusions.

Stack claims are only made where a shipped binary was torn down. So far that is Alpha Progression alone: Android APK v7.1.1, `com.alphaprogression.alphaprogression`, inspected 2026-07-25 by reading the APK's file listing and extracting its web bundle. Android only — Capacitor serves the same bundle to iOS, but the IPA was not checked. Obfuscation hides their application logic, not their library surface.

## Hevy

- Paywall cut: the loop itself is fully free and ad-free — unlimited logging, rest timer, supersets, plate calculator, PR detection. The squeeze is around it: 4 routines, 7 custom exercises, and a 3-month view-lock on your own history (introduced retroactively in Oct 2024, their angriest user threads). In-loop Pro gates: only the warm-up calculator and the Trainer. Pro $2.99/mo, $23.99/yr, $74.99 lifetime — the cheapest of the closed apps.
- Offline: full loop works offline with sync on reconnect (well-attested), but the architecture is cloud-first with a required account, and a dismissible "No connection — try again?" save dialog has historically lost finished workouts. No documented conflict story for phone+web edits.
- Data-out: export exists but is CSV/TSV *emailed* to your account address; import is Strong-CSV only. There is a real official API (Swagger-documented, read+write, webhooks, thriving third-party ecosystem including an MCP server) — but it's Pro-only: Hevy charges for access to your own data.
- Progression model: descriptive, not prescriptive — previous-values engine plus routine values that silently auto-update to what you actually did (prompting only on structural changes). Two-layer PR detection with live in-workout fanfare. Hevy Trainer (Feb 2026, Pro): algorithmic program generation with overload suggestions — their toe in kilorep's "smarter next session" water.
- Platform: iOS + Android at near parity (Live Activity on both), watch apps on both, and a real web app for routines/stats/API keys — the only closed app with a meaningful desktop surface. Web lags mobile on features.
- Threat: the highest. Hevy is the category default (240k+ Play reviews), sets the free-tier bar, owns the Strong-refugee migration path, and has the loop, the web surface, and now a progression toe-hold. Kilorep's wedge is exactly where Hevy's model forces it to be user-hostile: the paywalled API, emailed exports, view-locked history, and cloud-required account.

## Strong

- Paywall cut: free tier logs forever, but 3-routine cap monetizes setup, and two in-loop tools are PRO-gated at their point of use: the plate calculator button ON the weight keyboard, and warm-up-set generation. PRO $4.99/mo, $29.99/yr, $99.99 lifetime.
- Offline: local-first with background cloud sync; solid in dead zones. But signup is pushed before first workout, and "lost data" complaints persist enough that they keep a troubleshooting article for it.
- Data-out: CSV export only, explicitly one-way ("exported files cannot be imported back"). No API. No import at all — Hevy ships a dedicated Strong-CSV importer, so the exit path from Strong is paved by its competitor and there is no path back in.
- Progression model: none. Records only: previous-values auto-fill, PR detection, plate/warm-up calculators (paid). "Strong logs what you do but doesn't tell you what to do next."
- Platform: iOS + Android (iOS-first, Android weeks behind; superset creation flow differs per platform). No web. Actively developed again in 2026 after a widely-noted stagnation era that fueled migration to Hevy.
- Threat: the loop-polish incumbent. Its ~1-tap checkmark-accepts-previous-values pattern is the market bar kilorep must match on day one. As a business it's beatable exactly where kilorep plays: data-out and openness.

## Alpha Progression

- Paywall cut: the deepest cut in the group. Free tier is a bare manual logger; the entire in-workout intelligence layer (per-set weight×reps@RIR targets, plate calc, warm-up calc) is Pro — $12.99/mo / $79.99/yr, with a soft paywall shown during onboarding before the first workout. 2025 reviews briefly reported the free tier removed entirely; it exists today but is aggressively de-emphasized.
- Offline: works offline with sync on reconnect (current sources agree; a 2023 source said otherwise — since fixed).
- Data-out: CSV export, self-serve. No API. No history import; only plan-sharing via QR/link.
- Progression model: the whole pitch. Per-set prescriptions (weight, reps, target RIR) recomputed from past and current sessions; 4–6 week mesocycles with RIR ramp 3→0, set-count progression, configurable deloads; equipment-aware increments per gym profile. Maximally prescriptive mid-workout; logged RIR feeds the engine. Community respects the per-set math more than the generated plans.
- Platform: iOS + Android, no web, no watch app — though per Stack below, the app *is* a web app, so the missing web surface is a distribution choice, not a technical limit.
- Stack: a **Capacitor-wrapped web app**, and the only competitor stack verified by teardown rather than desk research. No cross-platform runtime: the arm64 split ships exactly one native lib (`libsigner.so`, Adjust attribution) — no `libflutter.so`, no Hermes/JSC. No UI framework either: zero trace of React, Vue, Angular, Svelte, Solid, Preact or Ionic components. It is hand-rolled vanilla JS + **jQuery 3.7.1**, with handlers declared inline as `data-data='{"click":{"action":"activateTabSection","pageId":"Training"}}'` and the tab bar as static markup in `index.html`. **PouchDB 9.0.0** on IndexedDB is the local store — that is the offline story above. Chart.js 2.9.3, moment.js, Vite build, bundle string-array obfuscated. 169 KB of hand-written CSS: no Tailwind, 11 custom properties, 52 `@keyframes`. Rubik. Firebase (auth/functions/storage/analytics/remote-config), RevenueCat for subscriptions, `cordova-plugin-health`. The native feel is bought with plugins — safe-area, navigation-bar, haptics, keep-awake (rest timer), local-notifications, date-picker, in-app-review. Ships ~3,500 asset files with one lazy chunk per exercise, hence a 166 MB download.
- Threat: the strongest "smarter next session" execution among the loop-fast apps. But its identity — prescriptions, mandatory RIR, pay-before-first-workout — is a stack of choices kilorep's vision explicitly refuses, and each one generates user resentment kilorep can collect.

## Boostcamp

- Paywall cut: none in the loop — the entire tracker (logging, rest timer, plate calculator, RPE/RIR, famous programs) is free forever; Pro ($59.99/yr, or $14.99 month-to-month) sells analytics and exclusive coach programs. Only loop-adjacent gate: a cap on custom programs.
- Offline: the group's cautionary tale. Officially "works offline once a program is loaded," but architecture is cloud-first with a cache: Android users report network errors that discard the just-typed set, and being stranded mid-gym when the routine won't load. Web↔mobile edits have corrupted program state.
- Data-out: nothing. No export, no API, no import. Users resort to a Chrome extension that scrapes the web History page's XHR responses — which return the entire history in one payload, so the data exists; they just don't hand it over.
- Progression model: its real moat — marketplace programs ship with executable progression logic (5/3/1 training-max waves, GZCLP linear+AMRAP rules, deload scheduling), so next session's weights are already computed and an as-written set is ~1 tap. Set-type labels (warm-up/work/drop/failure) feed the math.
- Platform: iOS + Android; web is program-creator + read-only history only, self-described "mobile-only" tracker. No watch.
- Threat: owns the "famous programs, free" wedge and proves computed-prescription logging is fast. Attackable on everything kilorep leads with: local-first reliability and data-out.

## Heavyset

- Paywall cut: logging itself never paywalled; one-time $19.99 "Lifetime Intermediate" IAP gates repeated use of saved routines — the paywall meters how often a free user may run their own routine. CSV export explicitly free.
- Offline: fully local, no account, no server; iCloud backup only (restore-grade, not sync).
- Data-out: the best file-based story of the closed apps: free CSV export of everything, plain-text routine DSL with pasteboard-sniffing import, formatted-text history sharing, CSV history import with presets for Strong/StrongLifts. Still no API.
- Progression model: no AI; user-programmed. Smart Values predict next weight/reps from history; % of training max auto-calculates loads; per-rep-count PR records; a deload tool with % sliders.
- Platform: iOS-only, iPhone-only, one developer, in maintenance mode (2024 update drought, 2025 maintenance releases). The ~1-tap crown is frozen ~2018 tech.
- Threat: not commercial — Android/web users can't even buy it. Its menace is as the design bar: ghost-value commit, docked LOG button, zero-tap rest and advance. Kilorep should treat Heavyset as the loop spec to beat and its plain-text formats as validation of the open-data thesis.

## RP Hypertrophy

- Paywall cut: total. No free tier, no trial — $34.99/mo or $299.99/yr, pay first with a 30-day refund guarantee. Nothing loggable without a subscription.
- Offline: none. Web-app-in-a-wrapper (4.3 MB iOS binary); the loop dies without connectivity, and their own App Store reviewers lead with it ("my gym has lousy connectivity and I hate having to wander around hoping for it to link up"). The Dec 2025 native-store launch changed nothing.
- Data-out: a roach motel. No export, no API, no health integrations, no import — at $299/yr. An open-source clone (MyFit) exists specifically because users want the algorithm with data ownership.
- Progression model: the real asset. Israetel volume landmarks operationalized: week-1 RIR-only calibration (no 1RM wizard), weekly weight bumps with a rep-substitution fallback when the next plate jump is too big, feedback-driven set adjustments per muscle (soreness asked at next session for that muscle, pump/workload at muscle completion), frequency-aware cross-session volume routing, computed deloads. No rest timer, no prescribed rest at all.
- Platform: PWA at training.rpstrength.com + thin store wrappers (Dec 2025). 4.3★ but Trustpilot 2.8 brand-wide.
- Threat: the fastest-growing progression menace, and the sharpest proof of kilorep's two theses at once: people pay $299/yr for a smarter next session, and they hate that it costs them offline, export, and a rest timer. Steal the algorithm ideas (later, post-v1); refuse every delivery choice.

## wger

- Paywall cut: none anywhere. AGPL, donations, free hosted instance at wger.de (now behind a proof-of-work bot wall); third parties sell managed hosting ~$16/mo.
- Offline: rebuilt June 2026 on PowerSync — gym mode fully works offline once the routine is synced locally. The catch for self-hosters: offline requires running an extra sync-service container with one-time storage setup and cron-scheduled compaction ("without periodic maintenance those logs grow unbounded"). Observed first-hand: the official docker-compose brings up seven containers and the PowerSync one crash-loops out of the box until that setup step is done. Local-first via a second distributed-systems product.
- Data-out: best-in-class, the bar for kilorep's own promise. API-first REST surface with self-hosted Swagger/ReDoc consoles; JWT auth; computed endpoints (routine structure, gym-sequence with supersets interleaved, stats by muscle/week); every log stores both prescription and performance; weight CSV in/out, PDF routines. Gaps: no full-account takeout file, no importers from other trackers. An official (embryonic) MCP server repo exists.
- Progression model: surprisingly sophisticated since the 2025 rebuild: iteration-based rules (+1kg every week as one record), percentage ops, rep-ranges, and requirements-gated progression (increase only if last iteration's logs hit target) — double progression as data, not code. But the rule builder is web-only; mobile only executes.
- Platform: Django server (Docker/Helm), Flutter app (Play/App Store/F-Droid/Flathub), full web UI, gym-management niche. Very healthy and accelerating: 45+ server commits and 88 flutter commits in the last 30 days, multiple 2026 releases — after a 16-month dormant patch in 2024.
- Threat: the only competitor attacking kilorep's exact thesis (yours + self-hosted) with real momentum. Its loop is still architecturally wrong (see benchmark), but "open trackers are unpolished" is weakening — they shipped offline, plate calc, and mid-workout swap in the last 12 months. Kilorep's edge must be the loop and true local-first, not openness alone.

## LiftLog

- Paywall cut: core app free, open source (AGPL), no account. One paid thing: a $9.99 one-time unlock for the hosted AI plan generator — and they document a free path around their own paywall (open plan-file format + a shipped Claude skill).
- Offline: genuinely local-first — SQLite on device, no sign-in, "the developer does not collect any data." Backup = gzipped file export/import plus optional automatic push of that backup to any user-supplied HTTPS endpoint (two reference servers ship in-repo). No multi-device live sync.
- Data-out: CSV and JSON exports exist but are explicitly not re-importable — only the opaque gzip backup round-trips. Plans, by contrast, are a first-class open format: `.liftlogplan` JSON with a published schema generated from the app's own models. No API.
- Progression model: simple and legible: plans pre-fill everything; on full success (all sets hit target max reps) the next session auto-increments by a per-exercise strategy (all sets evenly / lowest set first). Rest as a min–max window with phase colors and a separate failure rest. Plan-diff on finish offers to fold deviations back into the plan.
- Platform: iOS + Android, React Native/Expo (rewritten from .NET MAUI); web removed April 2026 (a stale build still answers at the old URL). Bus factor 1: ~85% of commits by one person — who shipped 10 releases in 10 days in July 2026. Tiny adoption (~21 App Store ratings).
- Threat: the proof that one person can build a 1-tap open-source loop. Not a market threat (no web, no sync, no audience) but a design rival on kilorep's own flank — and its opaque round-trip format is the mistake kilorep's export-is-canonical stance must not repeat.

## Threat matrix

| App | Taps/set (happy path) | Paywall in loop | Offline | Export | API | Progression | Platforms | Threat to kilorep |
|---|---|---|---|---|---|---|---|---|
| Hevy | ~1 | warm-up calc (Pro) | yes (cloud-first + account) | CSV by email | Pro-only | hints + Trainer (Pro) | iOS/Android/web | highest: the default |
| Strong | ~1 | plate calc, warm-ups (PRO) | yes (local-first + sync) | CSV one-way | none | none (records only) | iOS/Android | high: loop bar |
| Alpha Progression | ~1–2 | entire intelligence layer (Pro) | yes | CSV | none | prescriptive engine | iOS/Android | med: prescription-shaped |
| Boostcamp | ~1–2 | none | lossy cache, can eat sets | none | none | executable programs | iOS/Android (+web planner) | med: free programs wedge |
| Heavyset | ~1 | routine reuse metered | fully local | CSV free + text DSL | none | user-programmed | iOS only | design bar only |
| RP Hypertrophy | ~1–3 (+survey bursts) | everything ($299/yr) | none | none | none | auto-regulating engine | PWA + wrappers | high: progression menace |
| wger | ~1–2 (config-dependent) | none | yes (extra sync container) | API + CSV/PDF | best-in-class | rules-as-data | server/web/Flutter | high: same thesis |
| LiftLog | 1 | none | fully local | CSV/JSON one-way | none | success-gated increments | iOS/Android | design rival, open flank |

## What the matrix says

1. **Nobody holds both ends.** The fast-loop apps (Strong, Heavyset, Hevy) have no progression engine and weak-to-no data-out; the progression apps (Alpha, RP, Boostcamp) tax the loop with prescriptions, surveys, or connectivity; the open apps (wger, LiftLog) have the values but not the polish — though wger is closing that gap fast. Kilorep's claimed position (fastest loop + your data, hints not prescriptions) is genuinely unoccupied.
2. **Data-out is a market-wide failure, worse than the vision doc assumed.** Five of eight ship no API; three ship no export at all. wger alone sets a real bar, and matching its self-documented API console should be considered table stakes for kilorep's headline feature.
3. **Offline is marketed universally and delivered rarely.** Boostcamp eats sets, RP dies entirely, wger needs a second service. True local-first with invisible sync is a differentiator users already scream for in competitors' reviews.
4. **The $299/yr RP subscriber is the long-term prize.** They've proven willingness to pay for a smarter next session; every one of them is also being trained to resent online-only, no-export, no-timer delivery. Kilorep v1 doesn't compete for them (no AI in v1) — but the domain model should never paint progression intelligence into a corner.
