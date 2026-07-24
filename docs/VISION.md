# Vision

## One-liner

The workout tracker that is actually yours, and faster in the gym than anything else.

## The gap

Nobody combines data ownership with best-in-class polish:

- The open/self-hosted trackers are unpolished.
- The polished trackers (Hevy, Strong, Alpha Progression, Boostcamp) are closed, subscription-gated, and bloated: too many features, hard to learn, slow to use mid-workout.

Kilorep takes both sides: your data on your infrastructure, with an in-gym experience that beats the closed apps at their own game.

## What kilorep is

A personal fitness data platform: the Google Sheets replacement for fitness. It exists because a spreadsheet is open but not powerful enough, and the commercial apps are powerful but not yours.

Workout logging is the first module and the reason the product exists. Body weight is the second. Everything else is a possible future module, not a v1 concern.

"Powerful" means depth in the logging and progression model (load semantics, honest volume math, PRs, last-session hints), never breadth of features.

## Scope

v1 = workout logging + body weight. Nothing else.

Two rules govern every future feature:

1. **In-gym rule.** Nothing may ever add friction to the logging loop. The workout screen answers to this rule alone.
2. **Data-domain rule.** A new data domain (nutrition, measurements, sleep...) enters only as a self-contained module: own screen, own model, minimal UI, full export, and it never touches the workout loop. New domains need a written doc before code.

A feature enters only if it makes logging a set faster or makes the next session smarter.

Out forever: social features, feeds, sharing, exercise content library (videos, tutorials, courses), gamification (streaks, badges), nutrition databases as a v1 concern, wearables, heart rate, cardio tracking. AI only ever in service of "next session smarter", and not in v1.

Nutrition is named here as a possible future module (it fits the data platform thesis) and gets zero code and zero reserved UI in v1.

## Data-out is a headline feature

"You own your data" is only true if the data can leave. Export (CSV/JSON), an open API, and MCP access are top-3 marketed features, not plumbing. Kilorep must beat the spreadsheet at its own game: everything queryable, everything exportable.

## Platform and architecture principles

- One codebase. The web + native Android split killed v1: feature drift, a neglected mobile surface, double maintenance.
- Phone and web are both first-class. The phone is where workouts happen; the web is where planning and data review happen.
- Extreme offline. The entire in-gym experience works with zero connectivity: start the session, see targets and last-time hints, log every set, finish. Sync is opportunistic. The workout domain is local-first; the server is the home it reports back to.

## Posture

Open source. Monetization is possible later, never at the cost of data ownership.

## Name

Kilorep stays. Kilo and rep are the two atoms of the data model, the name is short, pronounceable in French and English, and the .com is owned. Revisit only if the product outgrows lifting and has a public; until then, closed question.

## Why v2 exists (diagnosis of v1)

v1 was never designed, it accreted: no product doc ever existed, the dashboard had no purpose, navigation surprised the user, and the two codebases drifted until the primary surface (mobile, in the gym) felt like an afterthought. Using it brought no pleasure. v2 starts from this document instead.
