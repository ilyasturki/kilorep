# Design

Gym floor first: tired, sweaty, one hand, phone at arm's length on a bench, between sets.

- **Gym-first ergonomics.** Every target between 44 and 60px — legible and reachable one-handed, not big for its own sake. Heavy type where it carries meaning, one-thumb reach, zero precision gestures mid-set. The commit button is the tallest control in the app because it is the one pressed with shaking hands.
- **Dark and light, both first-class.** Neither is an afterthought.
- **A single cobalt accent.** One accent, nothing else — no second colour for *done*, no semantic palette. Not green (reads as *success*), not amber (reads as *warning*): the commit button means "this logs the set" and nothing more. The accent is mostly text; exactly one filled control per screen.
- **Calm and dense.** The workout screen shows what the next set needs. The pleasure is speed and clarity, not decoration — which means depth separates surfaces, borders do not, and nothing is loud twice.
- **No surprises.** Every tap goes where it obviously goes.

Bar: Alpha Progression's restraint — grouped lists, separation by value, one filled control per screen — held to the level of intention worked tokens and cared-for details allow. Its letterforms are not the reference; Nunito is the face.

Not this: decoration that slows the loop, feature-dense screens that require learning, desktop-shaped forms squeezed onto a phone.

Type and feel are judged on the phone at arm's length, never from a specimen sheet.

Tokens, the type scale and the touch-target sizes live in `src/app.css`, with their reasoning.
