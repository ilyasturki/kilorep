# Lift — build conventions

Lift is the design system of **kilorep**, a gym workout-session manager and weight tracker.
Brutalist-sharp: dark-first, square corners, hairline borders, one volt accent (`#c5f53a`).
Content is dense and utilitarian. No decoration for its own sake.

## Setup

**No provider, no theme wrapper, no context.** Import the stylesheet and use the components:

```jsx
const { Button, Card, Stat } = window.Lift
```

Theming is automatic: the tokens flip on `prefers-color-scheme`. `:root` is the dark palette;
a light block overrides it. Do **not** build a theme toggle, pass a theme prop, or wrap anything
in a provider. There is none.

## Styling idiom: Tailwind utilities over Lift tokens

Style your own layout with utility classes. Never hardcode a hex, a font stack, or a px font
size that the system already names.

| Family      | Real names (this is the whole vocabulary)                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Surfaces    | `bg-canvas` `bg-surface` `bg-surface-2` `bg-canvas-veil`                                                                            |
| Text        | `text-ink` `text-ink-2` `text-ink-3`                                                                                                |
| Borders     | `border-line` `border-line-2`                                                                                                       |
| Accent      | `bg-accent` `text-accent-ink` `bg-accent-tint` `border-accent-line` `border-accent-line-soft` `border-accent-edge` `text-on-accent` |
| Danger      | `bg-red` `text-on-red`                                                                                                              |
| Muscle map  | `bg-muscle-low` `bg-muscle-med` `fill-muscle-low` `fill-muscle-med` `stroke-muscle-low-edge` `stroke-muscle-med-edge`               |
| Font size   | `text-micro`(11) `text-label`(12) `text-body-sm`(13) `text-body`(14) `text-body-lg`(15)                                             |
| Font family | `font-body` (Archivo) `font-mono` (JetBrains Mono)                                                                                  |
| Motion      | `animate-fade` `animate-fadeout` `animate-pop` `animate-slideup` `animate-slidein`                                                  |

Two custom utilities carry real meaning:

- **`mono`** — JetBrains Mono with tabular figures (`tnum`). Use on **every number that changes**:
  weights, reps, volumes, durations, dates. Without it digits jitter as values update.
- **`kicker`** — the small uppercase letter-spaced mono label above a section.

## House rules

- **Square corners.** No `rounded-*`. The single exception in the entire system is a
  `rounded-[2px]` on search-match highlights.
- **Breakpoints are NOT Tailwind's.** The stock scale is deliberately cleared
  (`--breakpoint-*: initial`). Lift's are `xs`360 `sm`480 `md`560 `lg`760 `xl`860. `sm:` means
  **480px here, not 640px**. Never reason from Tailwind defaults.
- **Prefer the named font sizes** (`text-body`) over Tailwind's scale (`text-sm`). One-off sizes
  are written as arbitrary values at their single call site.
- Borders are hairlines: `border` + `border-line-2`. Shadows are rare and only on overlays.
- Use `Stat` for a figure-over-caption. Use `Card` for any panel, never a hand-rolled div.

## Where the truth lives

- `styles.css` and its `@import` closure — the real tokens, fonts, and component CSS.
- `components/<group>/<Name>/<Name>.prompt.md` — per-component props and usage.
- `<Name>.d.ts` — the authoritative prop contract.

Read those before styling. They beat any summary here.

## Idiomatic composition

```jsx
const { Card, CardHead, Stat, Button, Badge } = window.Lift

<Card className="flex flex-col gap-5">
    <CardHead>
        <span className="kicker">Today</span>
        <h2 className="text-[22px] font-extrabold tracking-[-0.02em]">Push Day</h2>
    </CardHead>

    <div className="flex gap-10">
        <Stat value="12,480 kg" label="VOLUME" />
        <Stat value="6" label="EXERCISES" />
    </div>

    <div className="flex flex-wrap gap-2">
        <Badge variant="solid">chest</Badge>
        <Badge variant="soft">triceps</Badge>
        <Badge variant="outline">shoulders</Badge>
    </div>

    <Button tone="primary" size="lg">Start workout</Button>
</Card>
```

Note the split: Lift components for every real part, plain utilities (`flex`, `gap-5`) only for
layout glue.
