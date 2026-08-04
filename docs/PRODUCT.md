# Product

## Domain model

- **Exercise:** name, equipment, load mode (`total` / `per-hand` / `unilateral`), muscle targets (one primary + secondaries, eleven coarse groups), search aliases, source (catalog or custom), optional rest-duration override. A variation whose load or emphasis differs — grip, incline, stance — is its own exercise, linked to its canonical parent by `variantOf`: hints, history and PRs never cross entries (a close-grip pulldown hinted with wide-grip numbers is the hint lying), and lists fold a family into one row, variants behind an expander. Same movement under another name is an alias, not a variant. The seeded catalog starts small and grows in the repo — entries append-only, a slug never deleted or reused, no descriptions, no photos, no video, ever; the one visual allowed is a bundled line-art illustration per entry (`static/illustrations/<id>.svg`, carried over from v1's traced set), and an entry without one — sumo-deadlift, every custom — is a state every consumer tolerates. Custom exercises are first-class alongside it (later; while the user base is one person, the rule is *grow the catalog, never a custom, for a real exercise*).
- **Template:** session → entries → exercises → sets. An entry holding several exercises is a superset. A planned set prescribes reps only, nullable = open target. Weight is never planned.
- **Workout:** a copy-on-start snapshot of the template tree. Editing a template never rewrites history; editing a workout never touches the template.
- **Set:** weight, reps, type (`normal` / `warmup` / `drop` / `failure`), RPE, note, completed. Settled, arriving with the set extras: a per-set load-mode override in the long-press sheet, defaulting to the exercise's own mode and adding `single-side` (×1, override-only) — so both-together vs one-at-a-time Hammer Curls is one flip, and a mid-set drop to one arm is logged as its own `drop` set with honest volume. Never sticky across sessions. RPE is optional, never prompted, never prefilled and invisible to the check — one number stored on the 1–10 scale at half steps, which a preference relabels as RIR (`10 − rpe`); hint labels carry it where last time had one, `82.5 × 7 · RPE 8`.
- **Body weight:** date + kg, one per day, re-logging overwrites.

Math:

- **Volume** = Σ weight × reps × loadFactor (×2 for per-hand and unilateral), over completed working sets only.
- **Raw PR** = heaviest weight ever lifted on the exercise, tie-broken by reps at that load. No formula.
- **Estimated 1RM** (Epley) is a dashboard trend signal only, never the headline PR.

## The loop

**Start.** The app opens into the Dashboard, whose banner is the way in: continue the session running or start one, both landing on the Workout tab. The tab is two addresses and exactly one of them is true at a time: `/workout/live` while a session runs, `/workout` — an empty-workout action over a glance of templates, the rest one tab over — while none does, each redirecting to the other when the holder disagrees with it. Nothing starts a workout except an explicit start: the editor's button or a tap on the idle screen, never navigation. On the Templates tab a row opens its editor, and Start lives inside it, under the thumb — immediate-start-on-tap was weighed and retired there: one row cannot honestly carry both "open this plan" and "begin lifting now", and a mis-tap that starts a workout costs more than the tap it saves. The idle Workout screen is the one exemption: its rows can mean nothing but "begin", the screen itself is the proof no session exists to clobber, and a mis-tap starts an untouched session FINISH discards for free. "Repeat this workout" lives on any past workout in History. Exactly one workout is active at a time — starting a template over an unfinished session asks before it discards anything.

**During a set.** The screen shows what the next set needs: target or hint, weight, reps, check. Every set displays last time's actual weight × reps. The session list — exercise names, where you are — is a rail on a desktop and one tap away on a phone, for orientation, jumping, reordering and inserting.

**Log a set.** The check commits exactly what's on screen — the hint if untouched, your edits if touched. The hint is never silently written. Same-as-last-time is one tap. Deviating: ± steppers on the active set (±2.5 kg, ±1 rep, stepping from the hint); tapping the number types into it. Bar: 1 tap when the value is right, ≤3 interactions when it isn't.

**Rest.** Deferred. It returns only as something that can be switched off. The app never holds the screen awake either way: the phone's own timeout is the user's setting and a 90-minute session is not the app's to override.

**Mid-workout.** Add and remove sets on any exercise; an exercise keeps its last one. Reorder by drag, insert by catalog search, both from the session list. An inserted exercise lands at the end as its own entry, with last time's set count (three when nothing recalls it) — positioning is reorder's job, not a second thing insertion does. An added set shows the hint when history has a corresponding set, blank otherwise (check inert until values are entered). No skip state: unchecked sets remain uncompleted.

**Finish.** One tap, instant end, the screen settles into its idle posture. No summary, no ceremony. Unchecked sets stay in the record flagged uncompleted and are excluded from every stat. If the session drifted from its template, the prompt to apply the changes waits at the planning surface, not the gym floor.

## Screens

Every screen must justify its existence.

- **Workout** — the loop above while a session runs; idle, the place one starts. One tab, two screens, one address each.
- **Templates** — the list; a template's editor is its one surface — planning, deleting and starting all live there; a template that still says nothing (no name, no exercises) is never saved.
- **History** — workout list + detail; repeat-this-workout; drift-vs-template on the detail.
- **Exercises** — catalog + customs; detail carries history, raw best set, est-1RM trend.
- **Weight** — log + trend.
- **Dashboard** — four standing questions, one card each, no configuration: **Progressing?** (recent raw PRs, est-1RM direction on main lifts) · **Consistent?** (sessions this week vs your own habit — facts, never streaks) · **Balanced?** (working volume by muscle, recent weeks) · **Weight on track?** (trend). Home, and where the gear to Settings hangs. Anything that can't be phrased as a standing question stays off it — with one stated exception, the banner above the four: home owes the user a way into a workout, and that is an exit rather than a fifth answer. Two columns from `lg` and one below, and the long cards are capped rather than uncapped: a desk window holds all four at once, and a phone gets two of them and the banner before it scrolls rather than a single card of personal bests.
- **Settings** — behind the gear, not a tab: on home below `lg`, beside the mark in the top bar above it.

The app opens into the Dashboard, always.

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

- The tab bar's final order gets judged on the phone; History lands last until then. The Dashboard / Weight allocation shipped as: Dashboard holds the slot, Weight leaves the bar and is reached through the Dashboard's weight card — on the phone to be judged like the rest.
- Set extras: type, note, and the per-set load-mode override. The row stays `weight | reps | check` and the long-press sheet that holds Remove is where they go; what they look like in it is open. RPE left this list — it is built, and the collapsed pill on the logging card is where it landed rather than in the sheet.
