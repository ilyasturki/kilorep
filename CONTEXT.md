# Kilorep

Workout session manager and weight tracker for one lifter (or a small set of
isolated accounts). Sessions prescribe the plan; workouts record what actually
happened in the gym.

## Language

**Session**:
A reusable workout template, e.g. "Push Day". Prescribes exercises and rep
targets but never the load.
_Avoid_: routine, plan, program, template (alone — "session template" is fine
when disambiguating from the gym visit)

**Workout**:
One actual training instance, started from a session. Records the reps done
and the weight lifted. Owns a private copy of the session's tree, so later
template edits never rewrite history.
_Avoid_: session (for the gym visit), training, log

**Entry**:
The top-level ordered unit inside a session or workout. An entry holding one
exercise is a plain exercise; an entry holding several is a superset.
_Avoid_: block, group

**Superset**:
An entry with several exercises, rotated through back-to-back (A, B → A, B → …).

**Exercise**:
A movement in the catalog: name, equipment, compound/isolation type, the
muscles it works (each with an intensity), and search aliases. Each user owns
their own catalog copy.
_Avoid_: movement, lift

**Prescribed set**:
A set inside a session: a rep target only (possibly open/null). The load is
decided at workout time.
_Avoid_: target set, planned set

**Logged set**:
A set inside a workout: reps performed, weight in kilograms, and a `done`
flag ticked off mid-workout.
_Avoid_: completed set (done is a flag on it, not its name)

**Diverged**:
A workout whose structure no longer matches the session it was started from.
Gates the sync-back affordance.

**Bodyweight entry**:
One weigh-in per calendar day, in kilograms. Re-logging a day overwrites it.
_Avoid_: weight log (ambiguous with the load on the bar)

## Surfaces

**Gym loop**:
The mobile-critical flow: start a workout from a session, log sets, swap
exercises mid-workout, finish. The part of the app that must work offline.

**Device token**:
A long-lived bearer token (`kr_…`) held by a native app install, minted at
sign-in and revocable per-device from web settings. Same mechanism as the
MCP API tokens.
