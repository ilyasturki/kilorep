# Icons

Geometry from [Phosphor](https://phosphoricons.com) v2.1.1 (MIT, Copyright (c) 2023 Phosphor Icons), **bold** weight, vendored as local components. `@phosphor-icons/core` is a devDependency and a source of paths only — it is never imported by app code, so nothing from it can reach the bundle.

## Why bold, and why vendored

Bold because gym-first ergonomics wants marks readable at arm's length, and because bold is *drawn* bold — bumping `stroke-width` on regular-weight geometry muddies corners and closes counters at 17–20px, which is most of where these are used.

Vendored because the icons need adjusting (`Stack` is redrawn rather than taken — see the file) and because a runtime dependency buys nothing here: the paths are static, and a component per icon already gives Vite perfect tree-shaking.

Phosphor's `fill` weight is the intended partner for active/selected states — a filled tab against a bold outline one. Take it from the same `bold`/`fill` pair, never a second family. Ship the fill as its own file (`PlayFill.svelte`), not as a `weight` prop: a path chosen at runtime is exactly the dynamic template the rules below rule out.

**Check the pair before you rely on it.** `fill` is a solid silhouette for icons that draw an *object* (`play`, `barbell`, `house`) and a *boxed* variant for icons that draw *lines* — `list-bullets-fill` is a filled rounded square with the bars knocked out of it, which beside a true solid reads as a different icon rather than a heavier one. When a glyph has no usable partner, ship the bold alone and let the surrounding state carry the change; `ListBullets.svelte` is the worked example.

## Rules

- **Characters first.** `×` `−` `+` `·` are in Nunito and stay characters. An icon is what you reach for when the font can't supply the glyph (`⌫` and `⋯` are absent from our latin subset — measured in Chrome) or when there was never a character to begin with.

  One exception, and it is the whole exception: `AddRow` uses a glyph. A character takes the size of the text around it, and in that row the text is `label-caps` at 12px — so the mark that says *add* was drawn at the weight of the word beside it and the row read as two words rather than as an act. A glyph at 24 sizes independently of the label, and steps to 26 under a thumb like every other one. Nowhere else: `−` and `+` on `StepperField`'s arms are already 24px characters and have no such problem.

  `Plus` is the default and the right answer for a list that grows by one more of what it already holds. A row offering *two* acts cannot use it twice — one mark drawn on both halves leaves the labels carrying the whole distinction — so `AddRow` takes an icon per half: the workout screen's block ends on `RowsPlusBottom` for a set appended under the sets above it and `StackPlus` for an exercise joining the session, `Stack` already being this app's mark for a session.
- **One file per icon, no `<Icon name="…">` dispatcher.** A dispatcher defeats tree-shaking and adds a runtime branch. The shared `Glyph.svelte` frame is not one: it is chosen at author time by an ordinary import, so tree-shaking still sees exactly which glyphs a screen reaches. It costs one extra component instance per rendered icon.
- **The contract lives in `Glyph.svelte`**: `size` (number, default 24) and `class`, `data-glyph`, `viewBox="0 0 256 256"`, `fill="currentColor"`, `aria-hidden="true"`, `focusable="false"`. An icon file carries its geometry and nothing else, so it cannot get the frame wrong. Colour always inherits from the parent's `text-*`; the accessible name lives on the wrapping control.
- **`size` is the desk size.** Under a coarse pointer every glyph steps up one size — the table lives in `app.css` next to the touch-target tokens, keyed off `data-glyph` and the rendered `width` attribute. Write the size for a mouse and let the stylesheet answer for the thumb; never hand-pick a "mobile size" at a call site.
- **Nothing dynamic but `width` / `height` / `class`.** Everything else static so Svelte hoists the template.

## Adding one

Copy the `<path d="…">` from `node_modules/@phosphor-icons/core/assets/bold/<name>-bold.svg` verbatim into a copy of `Check.svelte`, dropping `xmlns` (inline SVG in HTML does not need it) — everything outside the `<Glyph>` tags is the same in every file. Do not re-space or re-fit the path — the whole point is that the family stays optically consistent without anyone eyeballing it.
