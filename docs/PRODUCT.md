# Product

## Domain model

- **Exercise:** name, equipment, load mode (`total` / `per-hand` / `unilateral`), muscle targets, search aliases, source (catalog or custom), optional rest-duration override. A seeded catalog ships (~200 entries: names, equipment, default load mode, muscles, aliases — no descriptions, no media, ever). Custom exercises are first-class alongside it.
- **Template:** session → entries → exercises → sets. An entry holding several exercises is a superset. A planned set prescribes reps only, nullable = open target. Weight is never planned.
- **Workout:** a copy-on-start snapshot of the template tree. Editing a template never rewrites history; editing a workout never touches the template.
- **Set:** weight, reps, type (`normal` / `warmup` / `drop` / `failure`), RPE, note, completed.
- **Body weight:** date + kg, one per day, re-logging overwrites.

Math:

- **Volume** = Σ weight × reps × loadFactor (×2 for per-hand and unilateral), over completed working sets only.
- **Raw PR** = heaviest weight ever lifted on the exercise, tie-broken by reps at that load. No formula.
- **Estimated 1RM** (Epley) is a dashboard trend signal only, never the headline PR.

## The loop

**Start.** The app opens into the active workout if one exists, otherwise into Start: template list plus an empty-workout action. Tapping a template starts the workout immediately — no preview, no confirm. Two taps from unlock to a loggable set. "Repeat this workout" lives on any past workout in History. Exactly one workout is active at a time.

**During a set.** The screen shows what the next set needs: target or hint, weight, reps, check. Every set displays last time's actual weight × reps. A session overview (exercise names, done/total sets) is one tap away for orientation, jumping, reordering and inserting.

**Log a set.** The check commits exactly what's on screen — the hint if untouched, your edits if touched. The hint is never silently written. Same-as-last-time is one tap. Deviating: ± steppers on the active set (±2.5 kg, ±1 rep, stepping from the hint); tapping the number opens the numpad. Bar: 1 tap when the value is right, ≤3 interactions when it isn't.

**Rest.** The timer auto-starts on check. A countdown chip — never a modal, never blocking the next log. On-screen only: nothing fires when rest ends if you aren't looking, so keep-awake is load-bearing. The chip derives from a stored `startedAt`, never an accumulating counter. One tap skips or adjusts. Duration: global default, per-exercise override.

**Mid-workout.** Reorder by drag, insert by catalog search, both from the session overview. An added set shows the hint when history has a corresponding set, blank otherwise (check inert until values are entered). No skip state: unchecked sets remain uncompleted.

**Finish.** One tap, instant end, back at Start. No summary, no ceremony. Unchecked sets stay in the record flagged uncompleted and are excluded from every stat. If the session drifted from its template, the prompt to apply the changes waits at the planning surface, not the gym floor.

## Screens

Every screen must justify its existence.

- **Start** — active workout or template list; gear to Settings; template editing reached from here.
- **Workout** — the loop above.
- **History** — workout list + detail; repeat-this-workout; drift-vs-template on the detail.
- **Exercises** — catalog + customs; detail carries history, raw best set, est-1RM trend.
- **Weight** — log + trend.
- **Dashboard** — four standing questions, one card each, no configuration: **Progressing?** (recent raw PRs, est-1RM direction on main lifts) · **Consistent?** (sessions this week vs your own habit — facts, never streaks) · **Balanced?** (working volume by muscle, recent weeks) · **Weight on track?** (trend). Never the landing screen. Anything that can't be phrased as a standing question stays off it.
- **Settings** — behind the gear, not a tab.

The app opens into Start, always.

## Offline

- **On the device: everything** — templates, catalog + customs, full history, body weight.
- **The server is optional.** The phone is complete standalone: install, lift, export, forever. Connecting a self-hosted server adds sync, the web surface, and the API/MCP.
- **Sync** is opportunistic push/pull. Conflicts are last-write-wins per record; no merge UI. A finished, synced workout is never clobbered.
- First install works immediately, empty and serverless. New device with a server: sign in → full pull → identical.

## Data-out

- **Export** is generated on-device, no server required. Two shapes: a lossless JSON dump (every entity, every field, sufficient to rebuild the database) and spreadsheet-shaped CSVs (one row per set: date, exercise, set number, type, weight, load mode, reps, RPE; body weight as date, kg).
- **API:** token-authenticated REST on the server — everything the app can do, readable and writable.
- **MCP:** the server speaks MCP.
- **No v1 import.** v2 starts fresh; hints stay silent until history rebuilds.

## Unresolved — settle on the phone

- Workout screen: focused one-exercise view vs full scrollable session list.
- Which of Start / Dashboard / History / Exercises / Weight earn a tab slot.
- Where set extras (type, RPE, note) live. Candidate: row stays `weight | reps | check`, everything else behind a long-press sheet.
