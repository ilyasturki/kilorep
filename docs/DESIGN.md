# Design brief

The character of the app, fixed before any screen is drawn. The stack is now chosen ([STACK.md](STACK.md)), so the design system is unblocked: authored directly in Svelte, with **no component bundle and no React mirror**. Design happens freeform in claude.ai/design; what comes back is HTML and token classes, which port to Svelte near-verbatim. The first real build on the phone is this brief's first test.

## Context

Designed for a gym floor first: tired, sweaty, one hand, phone at arm's length on a bench, between sets.

## Principles

- **Gym-first ergonomics.** Huge tap targets, one-thumb reach, fat type readable at arm's length, zero precision gestures mid-set.
- **Dark and light, both first-class.** Neither theme is an afterthought; both ship polished from day one.
- **A single lime accent.** Tailwind `lime-500` (`#7ccf00`). v1's `#c5f53a` is retired in favour of palette consistency: the app takes its colours from Tailwind's ramp, which hands over `lime-400/600/700` for hover, pressed and disabled states for free. v1's green is far lighter (L .905 vs .768) and more yellow (H 123.6 vs 130.9). `lime-400` was the first pick off that ramp and was dropped for the same reason as v1's: at L .841 and near-peak chroma it haloes against the white card it sits on at commit-button size. `lime-500` keeps the chroma (.233 against .238 — it gives up no loudness) and loses the glow. Lime and not green or amber, because green reads as *success* and amber as *warning*, and the commit button has to mean "this logs the set" and nothing else. One accent, in both themes, unchanged between them.
- **Calm and dense.** The workout screen shows exactly what the next set needs, nothing else. The pleasure comes from speed and clarity, not decoration.
- **No surprises.** Every tap goes where it obviously goes. Navigation earns trust.

## Bar

Aplorio's level of intention (worked tokens, consistency, cared-for details), not its visual identity. Kilorep has its own character.

## Typography

Direction fixed now, because the face carries most of the app's character. Rounded sans.

- **The reference.** Alpha Progression — the one competitor mobile UI judged best-in-class in the audit — sets its entire interface in **SF Pro Rounded** (`body,button,input`), with Rubik only as accent type on paywall screens. See [COMPETITORS.md](COMPETITORS.md#alpha-progression). The rounded face is why it reads friendly instead of clinical, and it holds up at arm's length. Adopt the direction, not the file: they ship Apple's proprietary font inside an Android APK, which its license does not permit.
- **Working choice: Nunito** (SIL OFL, variable 200–1000). Closest licensable match to SF Pro Rounded's proportions and rounded terminals, and one variable file covers the whole weight range. Note: **Nunito**, not *Nunito Sans* — the latter is not rounded. Fallback if Nunito reads too soft or too wide: **M PLUS Rounded 1c** (7 weights, OFL).
- Rejected: Quicksand (geometric, weak at 13–15px, ambiguous digits), Varela Round (one weight), Comfortaa (legibility), Baloo 2 (display personality, too loud for a dense logger).
- **Lean bold by default.** Their weight distribution is the real lesson: 700 and 600 are the workhorses, and 400 appears three times in the entire stylesheet. "Fat type readable at arm's length" means semibold body copy, not regular. Default body to 600; treat 400 as the exception.
- **Uniform digit advances are mandatory.** Their one clear typographic miss: not a single numeric font feature in 169 KB of CSS, so digits are proportional and the layout twitches whenever a live weight, rep count or timer changes digit width. Kilorep is number-dense and its numbers change mid-set. The test is the *goal*, not the mechanism — measure the face's digit advances; `tnum` is one way to get uniform ones, not the only way. A face whose figures are already monospaced passes without the feature. **Nunito passes:** it ships no `tnum` (nor does M PLUS Rounded 1c, so the feature test alone would have wrongly disqualified both), but its digits are all 600/1000 em at every weight on the axis. Measured in Chrome: `111.11` and `888.88` render at an identical 116.930 px. `font-variant-numeric: tabular-nums` is set globally anyway, as insurance for the day the face is swapped.
- **Relative units, honor the OS setting.** They hard-code px (13/15/17/22/27/30 — iOS's text-style sizes), so system font-size preferences do nothing. Use rem/sp and respect Dynamic Type and Android font scale: the tired user reading at arm's length is exactly the person who has already turned system text up.
- **Judge it on the phone.** Pick the face on the first real build of the workout screen, at arm's length — never from a specimen sheet.

## Anti-goals

- Decoration that slows the loop.
- Feature-dense screens that require learning.
- Desktop-shaped forms squeezed onto a phone.
