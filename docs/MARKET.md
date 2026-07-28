# Market bar

Researched 2026-07-24 across eight trackers (desk research; hands-on where a web surface exists). Tap counts are estimates.

**The bar for logging one set: ~1 tap, under ~2 seconds, when the value on screen is already right.** Every serious competitor hits it via prefill-then-confirm. Nobody has solved the deviation path — changed values cost ~4–9 taps everywhere.

Kilorep's target: **1 tap when right, ≤3 interactions when wrong, rest and advance free.**

| App | As-planned | Changed values | Rest | Advance |
|---|---|---|---|---|
| Heavyset | ~1 | ~3–8 (retype) | auto | auto |
| Hevy | ~1 | ~5–9 (keyboard) | auto | scroll/auto |
| Strong | ~1 | ~6–9 (keypad) | auto | manual |
| LiftLog | 1 | 1+Δreps / ~5 weight | auto | one screen |
| Boostcamp | ~1–2 | ~5–8 | auto | manual |
| Alpha Progression | ~1–2 | ~4–6 (incl. RIR) | auto | manual |
| wger | ~1–2 | ~5–8 | swipe past a page | swipe |
| RP Hypertrophy | ~1–3 | +surveys ~5–8 | none exists | manual |

## Steal

- **Prefill-then-confirm.** The check is a compound commit: mark done, start rest, run PR detection.
- **Ghost values** as placeholder, commit-on-log, typing overwrites (Heavyset).
- **Tap-the-previous-column** to fill today's row.
- **Tap-to-decrement for misses** — failure entry costs proportional to how close you got, no keyboard (LiftLog).
- **Zero-tap rest and zero-tap advance** — auto-advance to the next incomplete exercise (Heavyset).
- **Docked entry row + commit button in the thumb zone** — every set logged from the same position.
- **Per-exercise persistent notes** (seat height, grip) and per-category default rest durations (Alpha).
- **Template reconciliation at finish**, fired only on structural changes, never for weights (Hevy, Strong, LiftLog).
- **Dual storage of prescription and performance** on every log (wger).
- **In-context PR banner** with previous best and its date, zero interaction (Heavyset).

## Refuse

- **Ceremony between the last set and the pocket** — share flows, confetti, star ratings, streaks.
- **Business friction in the loop** — paywalled plate calculators and warm-up tools sitting inside the logging path.
- **Connectivity in the loop.** Boostcamp discards typed sets on network errors, RP dies without a signal, Hevy's finish dialog can lose a workout.
- **The rest timer as a navigation destination** rather than something running underneath (wger), or absent entirely (RP).
- **Mandatory subjective input** — per-set RIR, mid-session surveys.
- **Prescriptions as identity.** Hints, not orders.
- **Second-class mid-workout structural edits** — heavy menus, glitchy reordering, plan rigidity.
- **Exports that can't round-trip** (LiftLog's CSV/JSON), or exports emailed to you (Hevy), or none at all.
- **Decrement-only adjustment with no undo** (LiftLog): a stray tap silently edits logged reps.

## Where the market is weak

Five of eight ship no API; three ship no export at all. Offline is marketed universally and delivered rarely. Nobody holds both ends — the fast-loop apps have no progression engine and weak data-out; the progression apps tax the loop; the open apps (wger, LiftLog) have the values but not the polish, and wger is closing that gap fast.
