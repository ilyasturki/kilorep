# Icons

Geometry from [Phosphor](https://phosphoricons.com) v2.1.1 (MIT, Copyright (c) 2023 Phosphor Icons), **bold** weight, vendored as local components. `@phosphor-icons/core` is a devDependency and a source of paths only — it is never imported by app code, so nothing from it can reach the bundle.

## Why bold, and why vendored

Bold because gym-first ergonomics wants marks readable at arm's length, and because bold is *drawn* bold — bumping `stroke-width` on regular-weight geometry muddies corners and closes counters at 17–20px, which is most of where these are used.

Vendored because the icons need adjusting (`Stack` has no Phosphor original) and because a runtime dependency buys nothing here: the paths are static, and a component per icon already gives Vite perfect tree-shaking.

Phosphor's `fill` weight is the intended partner for active/selected states — a filled tab against a bold outline one. Take it from the same `bold`/`fill` pair, never a second family. Ship the fill as its own file (`PlayFill.svelte`), not as a `weight` prop: a path chosen at runtime is exactly the dynamic template the rules below rule out.

**Check the pair before you rely on it.** `fill` is a solid silhouette for icons that draw an *object* (`play`, `barbell`, `house`) and a *boxed* variant for icons that draw *lines* — `list-bullets-fill` is a filled rounded square with the bars knocked out of it, which beside a true solid reads as a different icon rather than a heavier one. When a glyph has no usable partner, ship the bold alone and let the surrounding state carry the change; `ListBullets.svelte` is the worked example.

## Rules

- **Characters first.** `×` `−` `+` `·` are in Nunito and stay characters. An icon is what you reach for when the font can't supply the glyph (`⌫` and `⋯` are absent from our latin subset — measured in Chrome) or when there was never a character to begin with.
- **One file per icon, no `<Icon name="…">` dispatcher.** A dispatcher defeats tree-shaking and adds a runtime branch; a shared wrapper component doubles the component instances on a screen that renders one icon per set row.
- **Keep the contract**: `size` (number, default 24) and `class`, `viewBox="0 0 256 256"`, `fill="currentColor"`, `aria-hidden="true"`, `focusable="false"`. Colour always inherits from the parent's `text-*`; the accessible name lives on the wrapping control.
- **Nothing dynamic but `width` / `height` / `class`.** Everything else static so Svelte hoists the template.

## The muscle family (`muscles/`)

Eleven body maps, one per `MUSCLES` entry, and the one thing here Phosphor did not draw — it has no anatomy set, so this geometry is ours. They are not Phosphor-shaped and must not try to be: a bold outline glyph cannot say *which* muscle without a body under it.

Each file is a lit region over a shared faint silhouette — `BodyFront.svelte` or `BodyBack.svelte`, imported, never copied. Copying the figure is how eleven icons stop being one family. The figure is a standing pictogram built from overlapping organic parts — curved torso path, tilted tapering limb capsules, deltoid caps tucked into the shoulder line — and the overlaps are free because the `opacity` sits on the group and composites once.

**The back view is load-bearing.** Biceps and Triceps are the same capsules in the same place; so are Quads and Hamstrings. The only thing telling them apart is the posterior base's 10px spine channel, which splits the trunk into halves. Measured in headless Chromium: clear at 28px, gone by ~20 — so the section header renders these at **28px** and anything smaller silently merges two pairs of sections. Do not shrink them without redrawing the pairs.

Same contract as the rest (`size`, `class`, `viewBox="0 0 256 256"`, `currentColor`, `aria-hidden`), so they colour from the parent's `text-*` like everything else. The faint layer is an `opacity` on the figure rather than a second colour, which keeps them single-token and theme-proof.

## Adding one

```
node_modules/@phosphor-icons/core/assets/bold/<name>-bold.svg
```

Copy the `<path d="…">` verbatim, drop `xmlns` (inline SVG in HTML does not need it), and paste into a copy of `Check.svelte`. Do not re-space or re-fit the path — the whole point is that the family stays optically consistent without anyone eyeballing it.
