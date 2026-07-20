# design-sync notes — kilorep

## Why this repo has a React mirror

kilorep is Nuxt 4 / Vue 3. claude.ai/design renders **React only** (the converter emits
`.jsx` + React-typed `.d.ts`, and designs import from `window.<globalName>.*`). There is no
Vue code path anywhere in the skill. So `design-system/` is a hand-maintained React mirror of
the Lift primitives in `app/components/ui/`, and it exists **solely** to feed the design tool.

**The Vue components are the source of truth. The mirror follows them, never the reverse.**

- Mirror package: `design-system/` (`@kilorep/lift-react`), own `package.json` and
  `node_modules`, deliberately NOT a workspace member so React never enters the Nuxt graph.
- Build: `cd design-system && npm run build` (tsup for JS+dts, Tailwind CLI for CSS).
- `npm run drift` diffs `design-system/src/styles/main.css` against `app/assets/css/main.css`.
  It must stay byte-identical; a diff means the app's tokens moved and the mirror is stale.

## Scope: 22 of 26 components

Deliberately excluded (Tier 3 — no Radix counterpart, would be genuine reimplementations that
look right but behave differently): **Combobox, DatePicker, NumberField, NumberStep**.
Everything else is mirrored. Revisit only if a design agent visibly needs them.

## Divergences from the Vue source

These are the places the mirror is NOT a literal copy. Each is forced, not stylistic.

- **`--reka-*` CSS vars became `--radix-*`.** `Select` (content available-height, trigger-width)
  and `Toaster` (toast swipe-move-x) read these out of class strings. Copying them verbatim
  would silently break panel sizing and swipe, since Radix publishes the same values under a
  different prefix. This is the one place a `tv()` block is intentionally not byte-verbatim.
- **Vue attribute fallthrough has no React equivalent.** The `.vue` files never declare
  `disabled` / `type` / `onClick` / `htmlFor` / `aria-label`; React must. They are declared
  explicitly on the components whose default element needs them (IconButton, FieldLabel,
  SegmentedOption, Button).
- **`PlanExercise.to`** renders `<a href>`; the Vue renders `router-link`. Prop name kept as
  `to`. If the mirror ever adopts a router, this is the line to revisit.
- **`Toaster` takes `toasts` as a prop.** The Vue pulls its queue from the app's `useToast()`
  composable, which does not exist here and could not render in a design anyway.
- **`Select` values are `string` only.** The Vue is generic over `string | number`; Radix
  Select requires string values.
- **`Input` dropped `defineExpose({ focus, select })`.** React 19 reaches the DOM node through
  a plain `ref`, so the imperative handle has no purpose. Rationale moved into its JSDoc.
- **`Logo`** takes only `className` (all four app call sites pass only a class). The SVG is
  hardcoded `aria-hidden` (decorative by design); widening is needed if a caller wants a label.
- **`Segmented` / `SegmentedOption` hold no state**, matching the Vue exactly (both import only
  reka's `Primitive`, so the parent owns selection). Consequence, inherited not introduced:
  the pair is not keyboard-accessible as a radio group in either framework.
- **`Primitive`** is built on `@radix-ui/react-slot` — reka's `asChild` and Radix's `Slot` are
  the same concept (reka is the Vue port of Radix). Its permissive prop escape hatch lives on
  the _function signature_, never on `PrimitiveProps`: components extend that interface into
  their public props, and an index signature there would erase the prop contract the design
  agent reads out of each `<Name>.d.ts`.
- **Icons are inlined.** The Vue uses `@nuxt/icon` (tabler) at runtime; the mirror inlines the
  three glyphs it actually needs (`src/lib/icons.tsx`) so the bundle stays self-contained.

## The CSS `@source` decision (important, non-obvious)

`design-system/src/styles/entry.css` scans **both** the mirror's `.tsx` **and the real Vue app**
(`@source '../../../app/**/*.vue'`).

The bundle ships a STATIC stylesheet — any utility absent at compile time simply does not exist
for the design agent downstream. Scanning only the 22 mirrored components would emit a narrow
vocabulary and the agent's own layout classes would silently resolve to nothing. Scanning `app/`
makes the emitted CSS a superset of what kilorep genuinely uses. Verified: `grid-cols-2`,
`sticky`, `backdrop-blur`, `animate-*` all land in `dist/lift.css` without any mirror component
using them.

The glob covers `*.{vue,ts}`, not just `*.vue`: the muscle-map utilities (`fill-muscle-low`,
`stroke-muscle-med-edge`) are built in `.ts`, and scanning only `.vue` silently dropped them.
Any future class vocabulary built in TypeScript needs the same treatment.

**Re-sync risk:** if `app/` is ever restructured or the mirror moves, that relative `@source`
path breaks silently — CSS still compiles, just smaller. Check `wc -c dist/lift.css` stays in
the ~60KB range.

## Environment gotchas

- **Playwright on NixOS — pin 1.59.x, and do NOT override `PLAYWRIGHT_BROWSERS_PATH`.**
  This cost a full debugging cycle. nix sets `PLAYWRIGHT_BROWSERS_PATH` globally to a store path
  of _patched_ browsers (currently chromium build **1217**). The user cache at
  `~/.cache/ms-playwright` also holds builds 1208/1223, which look newer and tempt an override,
  but those are generic FHS binaries that **cannot execute on NixOS** — they launch and die with
  `Target page, context or browser has been closed`, which reads like a crash, not a platform
  mismatch. Match playwright to the _nix_ build instead:
  `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright@1.59.1 playwright-core@1.59.1` inside
  `.ds-sync/`, then run validate with the ambient env. Confirm the pin with
  `.ds-sync/node_modules/playwright-core/browsers.json` (`chromium-headless-shell` revision must
  equal the nix store dir). If nix bumps its browsers, re-derive the version rather than
  reaching for the cache.
- This machine's npm blocks install scripts by default (`npm warn allow-scripts`). esbuild still
  works, because modern esbuild ships its binary via optional platform packages rather than the
  postinstall. Do not chase the warning.
- Node v24, npm v11. The repo proper uses Bun; the mirror and `.ds-sync/` use npm deliberately,
  to keep their dependency trees out of `bun.lock`.

## Known render warns (checked on every re-sync; an unrecorded warn is new)

- **`[TOKENS_MISSING]` for 6 `--reka-*` vars** (`--reka-combobox-*`, `--reka-select-*`,
  `--reka-toast-swipe-move-x`). Expected and harmless. These arrive via the `@source app/**/*.vue`
  scan: Tailwind emits the arbitrary-value utilities it finds in `Combobox.vue` / `Select.vue` /
  `Toaster.vue`, whose vars reka sets at runtime in the Vue app. Nothing in the mirror reads them
  (the mirrored Select/Toaster use `--radix-*`, and Combobox is not mirrored at all), so the
  utilities are inert in the bundle. Do not "fix" by setting `tokensPkg` or `provider`.
- Font resolution: pass `cssEntry` a stylesheet whose `url()`s are **relative**. `main.css` uses
  absolute `/fonts/*.woff2` (correct for the Nuxt app, dangling in a design project), so
  `build:css` rewrites them to `./fonts/` and copies the woff2 into `dist/fonts/`. Pointing
  `extraFonts` at bare `.woff2` files instead makes the converter lift the absolute-URL
  `@font-face` blocks verbatim and ship a duplicated, half-dangling `fonts/fonts.css`.
  The woff2 are copied **straight from `../public/fonts/`** (the app's own) rather than kept as
  a second copy under `design-system/`: duplicated font binaries in git would drift from the
  originals with nothing to catch it, since `npm run drift` only covers `main.css`.

## Preview capture runs in LIGHT mode (deliberate)

Lift is dark-first (`:root` is dark; a `prefers-color-scheme: light` block overrides it), but
headless chromium reports `light`, so every captured preview and `.review.html` renders the
light theme. Decided 2026-07-20 to accept this rather than patch the capture scripts.

Rationale: the `<Name>.html` cards render **live** in the DS pane, so a viewer on a dark OS
already sees dark Lift. Only local verification screenshots are affected. Forcing dark would
mean editing `.ds-sync/package-validate.mjs` and `package-capture.mjs` (`newPage({colorScheme:
'dark'})`), and `.ds-sync/` is re-copied from the skill on every re-sync, so the patch would
silently revert. There is no env hook for it (`DS_CHROMIUM_PATH` sets the binary only).

**Consequence to accept knowingly:** dark-only rendering bugs are never machine-verified here.
Lift's near-black surfaces are where its subtler decisions live (`--accent-edge` exists purely
to stop the volt fill blooming against dark; hairline `--line` borders are rgba-on-dark). If a
dark-mode rendering complaint ever surfaces, reproduce it by capturing with `colorScheme: 'dark'`
manually before assuming the components are wrong.

## Findings about the Vue design system (surfaced by mirroring it)

Porting Lift to React and rendering every component in isolation exposed things the app itself
never shows. **Three were fixed in the Vue source on 2026-07-20** and ported to the mirror; the
last is recorded as intentional.

- **FIXED — `Input` had no visual disabled state.** Its `tv()` base sets `text-ink` and
  `bg-surface` explicitly, which override the UA's default disabled greying, and no variant
  reintroduced it, so a disabled Input was pixel-identical to an editable one. Added
  `disabled:cursor-not-allowed disabled:opacity-45` to the base (matching Button's treatment).
  Regression cell: `Input/Disabled`.
- **FIXED — `Select`'s trigger `capitalize` title-cased every word.** Worse than first reported:
  it hit `English (UK)` → `English (Uk)` and turned the whole MCP scope picker into
  `Local — This Project, Just You`. The fix distinguishes **derived** labels (a bare enum value
  like `'barbell'`, which genuinely needs title-casing) from **authored** ones (an explicit
  `{label, value}` entry, which must survive verbatim) via a new `authored` tv variant, applied
  per row since one list can mix both. Verified against every call site: `EQUIPMENT`,
  `MUSCLE_INTENSITIES` and `muscleOptions` (`Object.values(MUSCLE_GROUPS).flat()`) are bare
  strings and still capitalize; `SUPPORTED_LOCALES`, `localeItems` and `scopeItems` are authored
  and now render untouched. Regression cell: `Select/InField`.
- **FIXED — `Button` applied `justify-center` only to the `primary` tone**, so a `flex-1` ghost
  or danger button left-aligned its label (live at `app/pages/workouts/index.vue`, where Review
  carries `flex-1`). Moved to the base: inert at natural width, correct when stretched.
  Regression cell: `Button/Stretched`.
- **NOT a defect — `CardActions` ships `mt-4.5` but `CardHead` ships no margin.** Every real call
  site passes `class="mb-4"` to CardHead itself. Asymmetric but consistent across the app.

Two states remain unstyled by design and were deliberately left alone: `IconButton tone="danger"`
is hover-only, and `SegmentedOption` disabled has no `tv()` treatment.

## Preview-authoring conventions (for future waves)

- **`preview-rebuild.mjs` does NOT rebuild `_ds_bundle.js`.** It only recompiles the preview
  `.tsx` files. After changing a _component's source_ under `design-system/src/`, a
  preview-rebuild + capture will silently re-shoot the cards against the **old** bundle and look
  like the change did nothing. Cost a full debugging cycle on the Select fix. Component source
  changes need `package-build.mjs` or a full `resync.mjs` driver run.
- Grades follow the authored `.tsx`, not the component implementation, so a component whose
  _source_ changed reports `carried forward` and is not recaptured. Force a fresh sheet with
  `package-capture.mjs --components <N> --spot-check-components <N>` when you need to _see_ an
  implementation change.

- Author `.design-sync/previews/<Name>.tsx`; each named export is one graded card cell. Budget
  2-4. Import from `'@kilorep/lift-react'`.
- **Curate from real call sites**, do not invent: `grep -rn "Ui<Name>" app/`. Every card in this
  run is a port of production usage, with real constants (`EQUIPMENT`, `MUSCLE_INTENSITIES` from
  `shared/utils/exercise.ts`) rather than stand-ins.
- **Primitive-based components do not accept `style`** — `PrimitiveProps` deliberately surfaces
  only `className`/`as`/`asChild`/`children`. Put preview layout scaffolding on a wrapper `div`.
  `Input` is the exception (it extends `ComponentProps<'input'>`).
- **`autoFocus` captures a `:focus` state statically** — the only way to see Input's
  `focus:border-accent` volt border in a still. Only one cell per sheet can hold it.
- **Overlay/portal components capture in their resting state.** Modal is forced open via
  `cfg.overrides.Modal`. Select was deliberately left closed: the trigger is the surface a design
  agent actually composes with, and forcing it open costs shared-state churn for little gain.
- **The mirror exports no icons.** `src/lib/icons.tsx` inlines three glyphs for internal use only.
  Previews needing a glyph inline their own small SVG. If many more need them, export the set
  rather than duplicating paths per preview.
- **`position: fixed` does not escape a preview cell.** The card HTML sets
  `transform: translateZ(0)` on BOTH `.ds-cell` and `.ds-single`, and a transform becomes the
  containing block for fixed descendants. Toaster's `fixed right-0 bottom-0` viewport therefore
  resolved against a zero-height wrapper and rendered off the top of the frame (a 1px sliver).
  Fix: wrap the cell in an explicit stage, e.g. `<div style={{height: 560, width: '100%'}}>`.
  **`cfg.overrides.<Name>.cardMode: "single"` does NOT help** — `.ds-single` carries the same
  transform. Any future fixed-position component hits this identically.
- **Capture runs at 900x700, above the `md` (560px) breakpoint.** Anything implemented purely in
  `max-md:` utilities is inert in a still. `Segmented`'s `stretch` prop is exactly this, so it
  has no cell: a stretch card would be pixel-identical to the default. A whole-component
  `viewport` override would force the component's _other_ cells narrow too, so it was declined.
- Two states cannot be captured statically because the components only define them on `:hover`:
  `IconButton tone="danger"` (`hover:border-red hover:text-red`) and `SegmentedOption` disabled
  (no `tv()` styling at all, so it is indistinguishable from idle). A third: `PlanExercise` with
  `to` set differs from the plain form only by `group-hover/plan-ex:text-accent-ink`, so its
  `Linked` cell is legitimately pixel-identical to `Rows`.
- **Highlight/MatchedLabel match positions come from the real matcher.** `bun` loads
  `app/utils/fuzzy.ts` directly (no build step), so previews run real queries against real
  catalog names from `server/database/exercise-catalog.ts` instead of hand-placed indices.
  Gotcha: `fuzzyMatch` only returns `matchedKeyword` when a keyword **outscores** the label, and
  the label carries `LABEL_BOOST = 3`. Obvious pairs tie and silently fall back to the plain
  form (`'Romanian Deadlift' / ['rdl'] / 'rdl'` ties at 22), which yields an alias preview that
  never shows an alias. Use queries that genuinely miss the name: `military` (Overhead Press),
  `french` (Skull Crusher), `fly` (Reverse Pec Deck).
- **`Badge` is not a generic chip** — its base includes `capitalize`, so using it to display a
  typed query renders `bp` as `Bp`. Use a plain `mono` span for verbatim text.
- **`style` is passed through at runtime but is not in the prop contract.** `Primitive` accepts
  anything (`PrimitiveProps & Record<string, any>`), so `...rest` forwards `style` and previews
  compile (esbuild, no typecheck). But the emitted `<Name>.d.ts` declares only
  `className`/`as`/`asChild`/`children`, so a typechecked consumer would be rejected. If this
  bites, declare `style?: CSSProperties` on the component props rather than loosening
  `PrimitiveProps`.

## How to re-sync (exact commands)

Run from the repo root. Project is pinned in `config.json`
(`954ed021-3cc2-4359-99bb-f1c9852225f5`, "Kilorep — Lift").

```sh
# 1. Re-stage the converter (a stale .ds-sync/ runs an old converter)
SB=<skill-base-dir>/design-sync
cp -r "$SB"/package-build.mjs "$SB"/package-validate.mjs "$SB"/package-capture.mjs \
      "$SB"/resync.mjs "$SB"/lib "$SB"/storybook .ds-sync/

# 2. Converter deps + the NixOS-correct playwright (see Environment gotchas)
(cd .ds-sync && npm i esbuild ts-morph @types/react \
   && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i playwright@1.59.1 playwright-core@1.59.1)

# 3. Rebuild the mirror (JS + dts + Tailwind CSS + font copy/rewrite)
(cd design-system && npm install && npm run build && npm run drift)

# 4. Fetch the verification anchor, then run the driver
#    (get _ds_sync.json from the project -> .design-sync/.cache/remote-sync.json)
node .ds-sync/resync.mjs --config .design-sync/config.json \
  --node-modules design-system/node_modules --entry ./design-system/dist/index.js \
  --out ./ds-bundle --remote .design-sync/.cache/remote-sync.json
```

The driver prints one verdict (also `ds-bundle/.resync-verdict.json`). Grade anything in
`verification.pendingGrade`, then upload per the skill's §5 (full writes, `deletes` verbatim
from `upload.deletePaths`, `_ds_sync.json` absolutely last).

**State of this run (2026-07-20):** 22 components, 64 cells, all graded `good`, 0 floor cards,
121 files uploaded, validate exit 0 with the one known `[TOKENS_MISSING]` warn. A clean re-sync
with no source change should report `upload.any: false` and grade nothing.

## Re-sync risks

- **The mirror can silently drift from the Vue.** Nothing enforces parity except `npm run drift`
  (CSS only). A prop added to a `.vue` component will not appear here until someone ports it.
  On every re-sync, diff `app/components/ui/*.vue` against `design-system/src/components/*.tsx`
  for the 22 mirrored names before trusting the output.
- Tier 3 exclusions are a standing decision, not an oversight — see Scope above.
- The `--radix-*` var renames are invisible to any automated check. If Select's panel stops
  sizing to its trigger, look there first.
