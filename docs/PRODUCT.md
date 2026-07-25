# Product

Sketch-level, not pixel spec. Clear enough to build from, refined while building.

## Domain model

Free of v1's schema; the domain wins carry over: per-exercise load modes, blank open targets with last-logged hints, honest volume math, raw PRs.

- **Exercise:** name, equipment, load mode (`total` / `per-hand` / `unilateral`), muscle targets, search aliases, source (catalog or custom), optional rest-duration override. A seeded, data-only catalog ships (~200 entries: names, equipment, default load mode, muscles, aliases — no descriptions, no media, ever). Custom exercises are first-class alongside it.
- **Template / planned session:** session → entries → exercises → sets. An entry holding several exercises is a superset. A planned set prescribes **reps only**, nullable = open target. Weight is never planned — progression is recall, not prescription.
- **Workout (a performed session):** a full copy-on-start snapshot of the template tree. Editing a template never rewrites history; editing a workout never touches the template. Drift between the two is computed, but surfaced only on the planning side (see Finish).
- **Set:** weight, reps, type (`normal` / `warmup` / `drop` / `failure`), RPE, note, completed. Warmup sets are excluded from volume and PRs. The extras (type, RPE, note) are committed to the schema but droppable from the UI if they clutter; their access pattern is proposed in design and settled on the phone (candidate: set row stays `weight | reps | check`, everything else behind a long-press sheet).
- **Body weight entry:** date + kg, one per day, re-logging overwrites.

Math, fixed here so every surface agrees:

- **Volume** = Σ weight × reps × loadFactor (×2 for per-hand and unilateral), over **completed working sets only**. No "un-entered counts as 0" ambiguity: uncompleted sets don't count, warmups don't count.
- **Raw PR** = heaviest weight ever lifted on the exercise, tie-broken by reps at that load. No formula.
- **Estimated 1RM** (Epley) exists only as a trend signal on the dashboard, never as the headline PR.

## The in-gym loop, set by set

The sacred path. I rack my dumbbells, I pick up the phone, and then:

- **Start a session:** the app opens into the active workout if one exists (auto-resume, no questions), otherwise into Start: the template list with an empty-workout action beneath it. Tapping a template starts the workout **immediately** — no preview, no confirm; the workout screen is the preview, and discarding an empty workout is one action. Two taps from unlock to a loggable set. "Repeat this workout" lives on any past workout in history. Exactly one workout can be active at a time.
- **During a set:** the screen shows what the next set needs: target or hint, weight, reps, check. Every set displays **last time's actual weight × reps** — recall, not coaching. Layout (focused one-exercise view vs full scrollable session list) is deliberately unresolved: both are proposed in design, and the winner is settled with a thumb on the first real build on the phone — never from a screen. A session overview (exercise names, done/total sets) is one tap away for orientation, jumping, reordering, and inserting.
- **Log a set:** tap the check. The check **commits exactly what's on screen** — the hint/target if untouched, your edits if touched. The most common set in any session (same as last time) is one tap. This deliberately overturns v1's never-commit-the-hint invariant: the hint is still never *silently* written; the check is an affirmative claim. Deviating: fat ± steppers on the active set (±2.5 kg / ±1 rep, stepping from the hint); tapping the number opens a numpad. Steps stay fixed until the friction log demands otherwise. **Tap-count target: provisional until BENCHMARK.md is done** — the bar is "as few as the market or fewer", with one tap already beating Hevy's floor whenever the keyboard would have opened.
- **Rest:** the timer auto-starts on check. A quiet countdown chip — never a modal, never blocking the next log. **On-screen only, by decision: nothing fires when rest ends if you aren't looking.** Kilorep is the only app in its own threat matrix without an off-screen rest signal, and that is accepted, not overlooked (rationale in [STACK.md](STACK.md#accepted-costs)). Two consequences: keep-awake is load-bearing, because the screen must not sleep mid-workout; and the chip is always derived from a stored `startedAt`, never an accumulating counter, so resuming mid-rest is exact. One tap skips or adjusts. Duration: global default, per-exercise override on the Exercise.
- **Next exercise / reorder / insert mid-workout:** all from the session overview: drag to reorder, catalog search to insert. An added set shows the hint when history has a corresponding set (one-tap check), blank otherwise (check inert until values are entered). No explicit skip state: sets left unchecked simply remain uncompleted.
- **Finish:** one tap, instant end, back at Start. No summary, no ceremony, no confetti. Unchecked sets stay in the record flagged uncompleted and excluded from every stat — "planned 4, did 3" is honest history. If the session drifted from its template, the prompt to apply the changes waits at the planning surface, not the gym floor.

## Screens

Every screen must justify its existence. v1's dashboard died for not having one.

- Screen list:
  - **Start** — starts. Active workout or template list + empty workout; gear to Settings; template editing reached from here (planning is the same surface on phone and web).
  - **Workout** — the loop above. Answers to the in-gym rule alone.
  - **History** — remembers. Workout list + detail; "repeat this workout"; drift-vs-template shown on the detail.
  - **Exercises** — knows. Catalog + customs; detail carries the per-exercise depth: history, raw best set, est-1RM trend.
  - **Weight** — weighs. Log + trend.
  - **Dashboard** — answers "is training working?" in four standing questions, one card each, nothing else, no configuration: **Progressing?** (recent raw PRs, est-1RM direction on main lifts) · **Consistent?** (sessions this week vs your own habit — facts, never streaks) · **Balanced?** (working volume by muscle, recent weeks) · **Weight on track?** (trend). Never the landing screen. Anything that can't be phrased as a standing question stays off it forever.
  - **Settings** — behind the gear, not a tab.
- Navigation model: no surprises — every tap goes where it obviously goes. The app opens into Start, always. Tab structure (which of Start / Dashboard / History / Exercises / Weight earn a tab slot) is proposed in design and settled on the phone, alongside the workout-screen layout.

## Offline behavior

- What lives on the device: **everything** — templates, catalog + customs, full workout history, body weight. Years of lifting is a few megabytes; partial sync buys nothing and starves the hints. The entire in-gym experience works with zero bars, trivially, because nothing in it ever needs the network.
- Server model: **the server is optional.** The phone is complete standalone — install, lift, everything local forever, export included. Connecting a self-hosted server (in Settings) adds sync, the web surface, and the API/MCP. The server is the home the workout domain reports back to; you can be homeless.
- Sync model: opportunistic push/pull whenever connectivity exists. Conflicts: **last-write-wins per record.** Realistically only templates and exercises can conflict (workouts are born on one phone; body weight overwrites per day) — no merge UI, no CRDTs for a single user racing themselves. One sacred guarantee: a finished, synced workout is never clobbered.
- First install: works immediately, empty and serverless. New device with a server: sign in → full pull → identical.

## Data-out

Top-3 marketed feature, not plumbing. Beats the spreadsheet at its own game.

- Export: generated **on-device**, no server required — a serverless user owns their data too. Two shapes: a **lossless JSON dump** (every entity, every field, sufficient to rebuild the database) and **spreadsheet-shaped CSVs** (workouts flat, one row per set: date, exercise, set number, type, weight, load mode, reps, RPE; body weight as date, kg).
- API surface: token-authenticated REST on the server, carried from v1's pattern — everything the app can do, readable and writable.
- MCP: the server speaks MCP, carried from v1's pattern — the training history as a first-class conversational data source.
- **No v1 import.** v2 starts fresh; v1 stays archived and queryable where it is. Hints stay silent until history rebuilds naturally.

## Friction log (from daily use of v1)

Every annoyance hit while still training with v1 goes here, dated, as design input.

- _(empty — feed from the next session onward, dated `YYYY-MM-DD`, one line per annoyance)_
