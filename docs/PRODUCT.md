# Product

## Domain model

- **Exercise:** name, equipment, load mode (`total` / `per-hand` / `unilateral`), muscle targets (one primary + secondaries, eleven coarse groups), search aliases, source (catalog or custom), optional rest-duration override, optional standing note — freeform text, the seat number and the grip, written and read on the exercise's own screen and never surfaced in the logging loop. A variation whose load or emphasis differs — grip, incline, stance — is its own exercise, linked to its canonical parent by `variantOf`: hints, history and PRs never cross entries (a close-grip pulldown hinted with wide-grip numbers is the hint lying), and lists fold a family into one row, variants behind an expander. Same movement under another name is an alias, not a variant. The seeded catalog starts small and grows in the repo — entries append-only, a slug never deleted or reused, no descriptions, no photos, no video, ever; the one visual allowed is a bundled line-art illustration per entry (`static/illustrations/<id>.svg`, carried over from v1's traced set), and an entry without one — sumo-deadlift, every custom — is a state every consumer tolerates. Custom exercises are first-class alongside it (later; while the user base is one person, the rule is *grow the catalog, never a custom, for a real exercise*).
- **Template:** session → entries → exercises → sets. An entry holding several exercises is a superset. A planned set prescribes reps only, nullable = open target. Weight is never planned. A planned exercise may carry its own rest duration — absent, a number, or never-rest.
- **Workout:** a copy-on-start snapshot of the template tree. Editing a template never rewrites history; editing a workout never touches the template.
- **Set:** weight, reps, type (`normal` / `warmup` / `drop` / `failure`), RPE, note, completed. Settled, arriving with the set extras: a per-set load-mode override in the long-press sheet, defaulting to the exercise's own mode and adding `single-side` (×1, override-only) — so both-together vs one-at-a-time Hammer Curls is one flip, and a mid-set drop to one arm is logged as its own `drop` set with honest volume. Never sticky across sessions. RPE is optional, never prompted, never prefilled and invisible to the check — one number stored on the 1–10 scale at half steps, which a preference relabels as RIR (`10 − rpe`); hint labels carry it where last time had one, `82.5 × 7 · RPE 8`.
- **Body weight:** date + kg, one per day, re-logging overwrites.

Math:

- **Volume** = Σ weight × reps × loadFactor (×2 for per-hand and unilateral), over completed working sets only.
- **Raw PR** = heaviest weight ever lifted on the exercise, tie-broken by reps at that load. No formula.
- **Estimated 1RM** (Epley) is a Progress trend signal only, never the headline PR.

## The loop

**Start.** The app opens into Train, which is the way in: the session running, or the place one begins. The tab is two addresses and exactly one of them is true at a time: `/workout/live` while a session runs, `/workout` — an empty-workout action over two glances, the templates you wrote and the sessions you already did, the rest one tab over — while none does, each redirecting to the other when the holder disagrees with it. Nothing starts a workout except an explicit start: the editor's button or a tap on the idle screen, never navigation. On Plan's Templates half a row opens its editor, and Start lives inside it, under the thumb — immediate-start-on-tap was weighed and retired there: one row cannot honestly carry both "open this plan" and "begin lifting now", and a mis-tap that starts a workout costs more than the tap it saves. The idle Train screen is the one exemption: its rows can mean nothing but "begin", the screen itself is the proof no session exists to clobber, and a mis-tap starts an untouched session FINISH discards for free. "Repeat this workout" lives on any past workout in History, and is what a tap on the idle screen's second glance means — the same act one screen earlier, for the lifter whose answer to "what now" is "what I did last time". Exactly one workout is active at a time — starting a template over an unfinished session asks before it discards anything.

**During a set.** The screen shows what the next set needs: target or hint, weight, reps, check. Every set displays last time's actual weight × reps. The session list — exercise names, where you are — is a rail on a desktop and one tap away on a phone, for orientation, jumping, reordering and inserting.

**Log a set.** The check commits exactly what's on screen — the hint if untouched, your edits if touched. The hint is never silently written. Same-as-last-time is one tap. Deviating: ± steppers on the active set (±2.5 kg, ±1 rep, stepping from the hint); tapping the number types into it. Bar: 1 tap when the value is right, ≤3 interactions when it isn't.

**Rest.** The check starts one — mark done, start rest, advance. It is a strip docked at the foot of the app, on every tab so it survives the walk to Exercises mid-session, and never a screen of its own. Working sets only: a warmup starts nothing, and a superset rests once per round rather than between its legs. Two minutes by default, an exercise's own duration where it disagrees, a plan's own where it disagrees with that — and never-rest can be said at either level, on the exercise or on the one planned entry. A plan's duration is copied into the session it starts, so editing the template mid-workout changes nothing under the lifter's feet, and a repeated workout rests the way that day did. Skip and ±30s live on the bar and move this rest only; the default is never rewritten from the gym floor. At zero the phone is notified — a scheduled local notification, the only thing that reaches a dark screen — and the clock counts up until the next set is logged. Off for good in Settings, off for one session from the bar. The app never holds the screen awake either way: the phone's own timeout is the user's setting and a 90-minute session is not the app's to override.

**Mid-workout.** Add and remove sets on any exercise; an exercise keeps its last one. Reorder by drag, insert by catalog search, both from the session list. An inserted exercise lands at the end as its own entry, with last time's set count (three when nothing recalls it) — positioning is reorder's job, not a second thing insertion does. An added set shows the hint when history has a corresponding set, blank otherwise (check inert until values are entered). No skip state: unchecked sets remain uncompleted.

**Finish.** One tap, instant end, the screen settles into its idle posture. No summary, no ceremony. Unchecked sets stay in the record flagged uncompleted and are excluded from every stat. If the session drifted from its template, the prompt to apply the changes waits at the planning surface, not the gym floor.

## Screens

Every screen must justify its existence.

- **Train** — the loop above while a session runs; idle, the place one starts, by plan or by repetition. One tab, two screens, one address each. Leads the bar.
- **Templates** — Plan's first half; the list; a template's editor is its one surface — planning, deleting and starting all live there; a template that still says nothing (no name, no exercises) is never saved.
- **History** — a child of Progress, reached through its Training frequency card and from the idle Train screen, which glances at the last four and links to the rest; workout list + detail; repeat-this-workout; drift-vs-template on the detail.
- **Exercises** — Plan's second half; catalog + customs; detail carries history, raw best set, est-1RM trend.
- **Weight** — a tab of its own; today's weigh-in first, then log + trend. Half of what v1 tracks, and touched every morning rather than on training days — the door that earns is the bar, not the foot of another screen. Progress keeps its Body weight card, now a summary pointing at the tab.
- **Progress** — five cards, one subject each, no configuration: **Weekly work** (tonnage and working sets, twelve weeks) · **Strength** (recent raw PRs, est-1RM direction on main lifts) · **Training frequency** (sessions in the last seven days vs your own median — facts, never streaks) · **Sets per muscle** (working sets by muscle, split direct/indirect) · **Body weight** (trend). A card earns its place by stating one thing about your own training you could not work out in your head, and by pointing at where that thing is logged; anything else stays off, with no exceptions. Headings state rather than ask — the card is the answer, so the heading naming it as a question made the card say everything twice. Every window rolls back from now and none is anchored to a weekday: "this week" meaning "since Monday" drew a Tuesday morning as a collapse. Weekly work takes the full width, being the one card that is mostly chart; the rest are two columns from `lg` and one below, capped rather than uncapped, so a desk window holds the screen at once and a phone gets two subjects before it scrolls rather than a single card of personal bests.
- **Settings** — a tab like any other. Reachable from every screen including a live session.

The bar is **Train · Plan · Progress · Weight · Settings**. It read left to right as the tense of what each tab holds until Weight joined it — a daily act has no tense, and that reading was prose the bar got arranged for rather than anything the lifter was handed. Weight sits beside Progress, the two screens you open for a number rather than to lift. One bar serves both viewports: the tabs sit along the bottom on a phone and inside the top bar on a desk. No screen draws chrome of its own.

## Offline

- **On the device: everything** — templates, catalog + customs, full history, body weight.
- **The server is optional.** The phone is complete standalone: install, lift, export, forever. Connecting a self-hosted server adds sync, the web surface, and the API/MCP.
- **Sync** is opportunistic push/pull. Conflicts are last-write-wins per record; no merge UI. A finished, synced workout is never clobbered.
- First install works immediately, empty and serverless. New device with a server: sign in → full pull → identical.

## Data-out

- **Export** is generated on-device, no server required. Two shapes: a lossless JSON dump (every entity, every field, sufficient to rebuild the database) and spreadsheet-shaped CSVs (one row per set: date, exercise, set number, type, weight, load mode, reps, RPE; body weight as date, kg).
- **API:** token-authenticated REST on the server — everything the app can do, readable and writable.
- **MCP:** the server speaks MCP.
- **No v1 importer.** None ships and none is planned — but the operator's own v1 history was moved across once, on 2026-08-20, by a throwaway script pushing 153 records through `/api/sync`: 56 workouts and 91 weigh-ins from 2025-12-28 to 2026-08-01, plus v1's six plans imported archived so `workoutTitle` still resolves a name through `templateId` without the old plans crowding Plan or the idle Train screen. The two datasets are contiguous rather than overlapping — the switch happened on 2026-08-02 — so nothing merged and nothing was overwritten. One v1 session was dropped: a plan started that morning, never logged, and repeated in v2 fourteen minutes later. v1 exercises resolved to catalog slugs by hand; where a real movement had no entry, the catalog grew one (`decline-bench-press`, `incline-machine-chest-press`, `machine-curl`), and the rest folded into their nearest slug, which merges their history and PRs and is the one lossy thing here. v1 stays online at `v1.kilorep.com`, untouched, as the record of what was folded.

## Unresolved — settle on the phone

- The bar is settled at five; what is not is the phone's top chrome — judged at arm's length, not from a specimen sheet. If Plan's segment turns out to want stickiness more than Exercises' search field does, that is the trade to reopen.
- Set extras: type, note, and the per-set load-mode override. The row stays `weight | reps | check` and the long-press sheet that holds Remove is where they go; what they look like in it is open. RPE left this list — it is built, and the collapsed pill on the logging card is where it landed rather than in the sheet.
