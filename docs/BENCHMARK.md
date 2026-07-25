# Benchmark: the in-workout loop, torn down

Goal: know the market bar for the in-gym loop before designing ours, and list what to steal and what to refuse. A day of research, not a study.

Method: deep desk research per competitor (official help-center step-by-steps, app-store listings and screenshots, written reviews, Reddit, and source code for the open-source ones), plus hands-on runs where a real web surface exists: Hevy web (account run) and wger self-hosted locally via Docker (current release, 2.7.0a1). Boostcamp's web is program-creation only and LiftLog removed its web app, so their loops rest on desk evidence. No phone app was run first-hand; every tap count from written/video evidence is an estimate, marked `~`. Each entry states its evidence quality. Researched 2026-07-24. The differentiator audit (paywalls, offline, data-out, progression) lives in [COMPETITORS.md](COMPETITORS.md).

## Competitors

### Hevy

- Evidence: official help-center walkthroughs + 2026 reviews; web-app hands-on pending.
- In-workout loop, screen by screen: Workout tab → start empty, from routine, or copy a past workout. During a session: stopwatch and running volume totals up top; each exercise is a card with a set table (SET | PREVIOUS | KG | REPS | checkmark), rest-timer control under the exercise name. From a routine the weight/reps cells arrive pre-filled from last session; tapping the checkmark is the whole commit — marks done, plays sound, starts the rest timer, runs PR detection. Rest timer auto-starts, adjustable −15/+15 mid-rest, and lives on the lock screen as a Live Activity where sets can even be checked off without unlocking. Mid-workout: add exercise (searchable library), add set (inherits row above), swipe-delete set, 3-dots to reorder/replace, supersets with auto-scroll to the next partner. Finish: Finish button → save screen (title, visibility, "Update Routine Values" toggle) → structural changes prompt "Update Routine vs Keep Original" → shareables screen (skippable) → feed post.
- Logging one set: ~1 tap at pre-filled values; ~2 taps via tap-PREVIOUS-to-fill; ~5–9 taps when typing new weight+reps (system keyboard, no steppers).
- What to steal: prefill-then-confirm as the core primitive; the checkmark as compound commit (complete + timer + PR check in one gesture); tap-the-hint-to-fill; actionable lock-screen rest timer; smart superset scrolling; the "Update Routine vs Keep Original" prompt fired only on structural changes, never for weights.
- What to refuse: a 2+ screen social/share ceremony between last set and pocket; cloud-required save whose "No connection — try again?" dialog can drop a finished workout; the 150-set hard cap; no auto-finish (sessions run for hours if you forget).

### Strong

- Evidence: official help-center docs + 2026 reviews; no hands-on possible (no web).
- In-workout loop, screen by screen: start from template or empty. Exercise cards with a set table (Set | Previous | weight | reps | checkmark); previous-session values pre-fill every set. Weight field opens a custom numeric keyboard with a Next button that advances field→field and even across superset partners; the plate-calculator button sits on the keyboard itself (PRO). Tap the set number to tag warm-up/drop/failure/RPE. Rest timer auto-starts on the checkmark, per-exercise defaults with separate warm-up vs working durations, full-screen countdown with ± and skip. Mid-workout: add exercises, drag-to-reorder, swipe-to-delete sets. Finish anytime; if the session deviated from the template, one prompt offers to update it.
- Logging one set: ~1 tap at previous values; ~6–9 with changed values (field taps + custom keypad + checkmark).
- What to steal: one-tap confirmation against auto-filled previous values; rest-timer auto-start with warm-up/working split; the custom keyboard with Next and in-keyboard tool slots; set-number tap as the tag affordance; finish-time template reconciliation; direct-manipulation edits (swipe delete, drag reorder).
- What to refuse: PRO-gating tools that are visible inside the loop (locked plate-calc button on the keyboard); the 3-routine free cap that monetizes setup; platform-divergent core interactions (superset creation differs iOS vs Android); forced signup before the first workout.

### Alpha Progression

- Evidence: vendor screen-recording showcase + German and English reviews; no hands-on possible (no web). Tap counts inferred, not video-verified.
- In-workout loop, screen by screen: home shows the active plan's next workout. Every set row displays a precise prescription — weight × reps at a target RIR — pre-filled from the engine; accept path is glance → checkmark. Override path: adjust weight/reps, set RIR, then confirm. Automatic warm-up sets and plate calculator (both Pro). Rest timer auto-starts after logging, per-exercise-category durations, and the iOS Live Activity becomes a countdown bar. Mid-workout: similar-exercise swap finder, skip/delete/add exercises, dropsets/supersets, per-exercise notes that persist across sessions. Deload weeks are auto-prescribed. Finish: confirmation → gamified summary (star ratings, achievements, streaks, PRs).
- Logging one set: ~1–2 taps accepting the suggestion; ~4–6 overriding (weight, reps, RIR, confirm).
- What to steal: pre-filled rows + single-tap confirm (same speed, kilorep fills from last session instead of an algorithm); lock-screen countdown as ambient rest state; per-exercise persistent notes (seat height, grip); per-category default rest durations; equipment-aware increment hints; inline similar-exercise swap.
- What to refuse: mandatory per-set RIR entry (a tap plus cognitive load every set); prescriptive targets as identity — hints, not orders; the onboarding paywall before the first logged set; gamified finish ceremony between last set and pocket.

### Boostcamp

- Evidence: official feature pages and tips blog (documents exact gestures) + BarBend/GGR 2026 hands-on reviews; web is program-creation only, so no loop hands-on.
- In-workout loop, screen by screen: home surfaces the active program's current day. Spreadsheet-style set rows: prescribed target, weight and reps fields, a previous column showing last session. Percentage programs resolve training-max math to concrete weights before you look. "Tap a set, the timer starts" — auto-progression pre-fills the weight; tapping the previous column's values autofills them into today's row; tapping the set number recategorizes it (warm-up/work/drop/failure) and that classification feeds progression. AMRAP sets take typed reps. Plate calculator inline and free. Mid-workout: swap exercise with coach-suggested alternatives — and the app asks "apply to future workouts, or just today?"; add sets; swipe-left deletes. Finish: confirmation, history, PRs, weekly report.
- Logging one set: ~1–2 taps as-written (weight pre-computed); ~2 taps repeating last session via tap-previous; ~5–8 touches with typed changes. Edit paths (notes, reordering) are reported tap-heavy.
- What to steal: progression math resolved to a loadable weight before the user looks; the "future workouts or just today?" fork on swaps; tap-previous-to-autofill; set-type labels feeding progression; free inline plate calculator; famous programs as executable, progression-aware templates for cold start.
- What to refuse: cloud-first persistence whose network errors discard a typed set; a web surface that is second-class and can corrupt program state; a fast happy path surrounded by heavy edit paths; loop regressions shipping unnoticed (lock-screen timer quietly degraded).

### Heavyset

- Evidence: 10 official App Store screenshots inspected at full resolution + developer help docs; iOS-only, no hands-on possible. The strongest steal-source in the benchmark.
- In-workout loop, screen by screen: one screen holds the entire loop. Top: toolbar (plate calc, metronome, notes, Done). Middle: live progress chart of the current exercise with PR line and a stat strip. Bottom, permanently docked in the thumb zone: Set # | weight | reps | big LOG button. Smart Values pre-fill weight and reps as gray ghost text predicted from past workouts — if right, hit LOG; if wrong, type over them on a custom in-app number pad whose Switch key hops weight↔reps without leaving the pad. Rest timer auto-starts from the routine's per-exercise duration, counts down in a tile beside the exercise card; swipe up for presets and ± modifiers. When max sets are logged the logger auto-advances to the next incomplete exercise (supersets rotate automatically) — there is no "next" button. PRs slide in as a banner with the previous best and its date, zero interaction. Finish: one Done tap.
- Logging one set: ~1 tap at predicted values — and the full set-to-set cycle including rest and advance stays ~1 tap. Changed values ~3–8 (retype only; no steppers).
- What to steal: ghost-value commit (prediction as placeholder, LOG commits it, typing overwrites it); the permanently docked entry row + LOG in the bottom corner — every set logged from the same thumb position; the custom pad with Switch; zero-tap rest and zero-tap advance driven by the routine's min/max set model; in-context PR banner with previous-best delta; plain-text routine DSL with pasteboard-sniffing import.
- What to refuse: chart-dominant screen real estate while today's completed sets hide behind a drill-in; retype-only adjustment (a stepper would beat it); metering how many times a free user may run their own routine.

### RP Hypertrophy

- Evidence: official pages, help-center snippets, first-person forum accounts, 2026 App Store reviews; no hands-on (paid trial requires payment info — skipped by policy). Tap counts text-inferred.
- In-workout loop, screen by screen: mesocycle grid → today's session, exercises grouped by muscle. Week 1 shows no weights — only an RIR target; your chosen loads calibrate the engine. Week 2+ prescribes exact weight × reps per set, derived from last performance. Log = confirm/enter values, tap check. The signature friction: feedback surveys fire mid-session at trigger points — soreness when you next train a muscle, joint pain/difficulty when you finish an exercise, pump + workload when you finish a muscle group. No rest timer exists at all, and no offline: the loop dies without connectivity (top complaint in its own 2026 reviews). Mid-workout: add sets/exercises, dropdown swaps. Meso must start Monday; length immutable mid-cycle.
- Logging one set: ~1–3 taps bare; ~5–8 when a survey fires — and the worst case lands at peak fatigue (end of muscle group). ~25–40% of a session's interactions are survey overhead.
- What to steal (for a post-v1 progression module, never v1): week-1 RIR-only calibration as cold start; weight→rep substitution when the next plate jump is too big a percentage; frequency-aware cross-session volume routing; computed deloads; muscle-group-level feedback granularity as proof you never need per-set surveys.
- What to refuse: modal surveys inside the loop; mandatory subjective input as algorithm fuel; shipping a gym app with no rest timer; online-only webview delivery; $299/yr with no trial.

### wger

- Evidence: current master source code read by research agent + hands-on run of the self-hosted web (2.7.0a1 via official docker-compose, this machine, 2026-07-24). Strongest evidence tier in the benchmark for the Flutter loop and the web loop both.
- In-workout loop, screen by screen (Flutter app gym mode): the entire workout is a horizontal page carousel — start page → optional exercise-intro page → one page per set → one page per rest timer → session form → summary. Set pages pre-fill from the plan/progression engine, show past logs with tap-to-copy, weight/reps steppers at configured rounding, an RIR slider, and Save auto-advances. The rest timer is its own page: count-up stopwatch by default, countdown only if configured, haptic-only feedback, no auto-advance at zero, no lock-screen presence (open issue). Mid-workout swap/add exists on master; a stray tap on X abandons the session without confirmation.
- In-workout loop (web, hands-on): there is no live web loop. The web's "log workout" is a batch backfill form — date, times, general impression, and all planned sets pre-filled on one page. Observed first-hand: submitting gives zero visual confirmation, and clicking Submit twice silently created every log twice. Also observed: routine creation is plan-first (name + a 12-week date range before any exercise exists), and the older wger/apache demo image (2.3.0a2) shipped with a completely broken exercise picker — the cold start on stale packaging is a dead end.
- Logging one set: ~1 tap with timer pages disabled — a genuine 1-tap claim; ~2 interactions default (Save + swipe past the timer page); ~3 copying last session; ~5–8 for arbitrary changes. Web: a whole pre-filled session in ~2 clicks, but it's bookkeeping, not an in-gym loop.
- What to steal: dual storage of prescription and performance on every log (verified in the DB: 6×80 saved against target 8×80); requirements-gated progression rules as data ("increase only if last time's logs hit target"); tap-to-copy past-log rows; the computed gym-sequence endpoint separating planning model from what the phone shows next.
- What to refuse: every set and timer as a swipeable page (a 25-set day is a ~55-page carousel); a rest timer you navigate past instead of one that runs underneath; plan-first rigidity with no ad-hoc mode ("you will not be happy with this app", their own manual); web-only progression editing; forms that double-submit silently.

### LiftLog

- Evidence: full source code read (repo cloned by research agent); no hands-on (web app removed 2026-04). Interaction claims code-verified, not device-run.
- In-workout loop, screen by screen: upcoming-workout cards materialized from the plan, weights pre-copied from last session and auto-incremented if last time was a full success. All exercises on one scrollable screen; each set is a chip showing target reps with a ghost hint of last session's count; a focus ring marks the next set. The signature mechanic: tap an empty chip once → set logged complete at target reps, rest timer starts; tap again → decrement one rep (recording "got 7 of 8"); long-press → type exact reps. Weight tap opens a dialog with steppers at the exercise's increment and apply-to-this-set/uncompleted/all chips, defaulted sensibly. Rest is a window, not a deadline: min–max phases in neutral/green/red, longer single rest after a failed set, foreground-service notification when backgrounded. Finish: incomplete-sets confirmation, then a plan-diff modal offers to fold deviations back into the plan.
- Logging one set: 1 tap hitting target; 1 + (target − actual) taps on a miss; ~5 with a weight change.
- What to steal: tap-to-complete-at-target with tap-to-decrement (failure entry cost proportional to how close you got, no keyboard for the 90% case); rest as a colored min–max window ("phone face-down until it's green"); auto-increment only on full success; plan-diff-on-finish; the schema-first open plan format.
- What to refuse: decrement-only adjustment with no undo (a stray tap silently edits logged reps; 4-of-12 costs 9 taps); CSV/JSON exports that can't round-trip while only an opaque gzip restores; killing a platform and leaving a zombie build at the old URL.

## Synthesis

- The market bar for logging one set (taps, seconds): **~1 tap, under ~2 seconds, when the value on screen is already right** — every serious competitor achieves this via some form of prefill-then-confirm (Hevy/Strong previous values, Boostcamp/Alpha/RP computed prescriptions, Heavyset predictions, LiftLog plan targets). Heavyset extends ~1 tap to the whole set-to-set cycle by making rest and advance zero-tap. The real differentiation is the *deviation* path: changed values cost ~4–9 taps everywhere, and nobody has solved cheap miss-entry except LiftLog's decrement chips and (partially) steppers. Kilorep's loop must be: 1 tap when right, ≤3 interactions when wrong, rest and advance free.

| App | As-planned | Changed values | Rest | Advance | Evidence |
|---|---|---|---|---|---|
| Heavyset | ~1 | ~3–8 (retype) | auto | auto | screenshots+docs |
| Hevy | ~1 | ~5–9 (keyboard) | auto | scroll/auto (supersets) | docs+reviews |
| Strong | ~1 | ~6–9 (keypad) | auto | manual | docs+reviews |
| LiftLog | 1 | 1+Δreps / ~5 weight | auto | none needed (one screen) | source code |
| Boostcamp | ~1–2 | ~5–8 | auto | manual | docs+reviews |
| Alpha | ~1–2 | ~4–6 (incl. RIR) | auto | manual | recording+reviews |
| wger (app) | ~1–2 | ~5–8 | swipe past a page | swipe | source code |
| RP | ~1–3 | +surveys ~5–8 | none exists | manual | reviews+forums |

- Common failures across all of them:
  1. **The deviation tax.** Every app nails the happy path and fumbles the miss: full keyboard round-trips for a one-rep shortfall or a 2.5 kg change.
  2. **Friction creep from the business model.** Paywalls (Strong's keyboard plate-calc, Alpha's intelligence layer, Heavyset's routine metering, RP's everything) and ceremonies (Hevy's share flow, Alpha's confetti) leak into the sacred path.
  3. **Connectivity leaks into the loop.** Boostcamp discards typed sets on network errors, RP dies entirely, Hevy's finish dialog can lose a workout, wger's offline needs a second service. Claimed-offline is common; verified local-first is rare.
  4. **Mid-workout structural edits are second-class everywhere** — heavy menus, glitchy reordering, plan-rigidity ("not happy with this app" — wger's own manual).
  5. **The rest timer is either great or absent** — auto-start is table stakes the market has settled; wger makes it a navigation destination and RP simply doesn't have one.
- The opening kilorep exploits: match the 1-tap bar with prefill-then-confirm (last-session hints, not prescriptions), then win on everything the market concedes: a deviation path that costs ≤3 interactions (steppers + decrement-style miss entry, no keyboard for the common case); zero business friction in the loop, forever, structurally guaranteed by open source; true local-first where the finished set is durably on-device before any network exists; and data-out (instant lossless export, open API, MCP) in a market where five of eight competitors have no API and three have no export at all. Full audit in [COMPETITORS.md](COMPETITORS.md).
