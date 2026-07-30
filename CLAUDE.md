# kilorep

## Hard rules

Breaking one is a bug, not a preference.

1. **The domain, store and sync layer imports no framework.** Plain TypeScript. Domain math, sync protocol and persistence must be testable on their own and portable if the UI is ever rewritten.
2. **Runes only.** `$state` / `$derived` / `$props()` / snippets. Never `export let`, never `$:`, never a writable store inside a component, never slots.
3. **Never answer a Svelte or SvelteKit API question from memory.** Query context7 `/llmstxt/svelte_dev_llms_txt` first — runes were a hard API break and training data skews to Svelte 4.
4. **One `apiBase`.** `location.origin` on web; `null` in the shell until the user connects a server, which is a state the guards read as local-only rather than signed-out. **Never a bare relative `/api/…`** — it works on web and 404s in the APK, where the origin is `https://localhost` (Capacitor's `androidScheme` default; `capacitor://localhost` is the iOS spelling) and server endpoints were omitted from the static build. This bug will not show up in Chrome.
5. **`ssr = false` and `prerender = false` for the whole app, permanently.** The directives live on `src/routes/(app)/+layout.ts`, so every app route must go inside that group; `src/routes/dev/` keeps its own copy. The landing page at `src/routes/+page.ts` is the single exception, and sets both `true` on the web and both `false` in the app build — where there is no crawler to serve, and where adapter-static's SPA fallback overwrites the prerendered `index.html` anyway. Page options override the layout's, so the exception cannot leak. There is no global net: a route added outside those trees gets SvelteKit's default `ssr = true` and will not survive the APK build.
6. **No proprietary SDKs.** No Firebase, no analytics, no RevenueCat. Ever.
7. **Nothing may add friction to the logging loop.** The workout screen answers to that rule alone — see [SCOPE.md](docs/SCOPE.md).

## Easy to get wrong

- **`seq` is claimed with `claimSeq()`, inside the same transaction as the write it stamps.** Claim it outside, and a failure between the two leaves a consumed number on no record — the client's watermark then steps straight over a row that was never written.
- **Records carry `deletedAt` tombstones.** Without them, deletes resurrect on the next pull.
- **Volume counts completed working sets only.** Warmups never count; uncompleted sets never count. Per-hand and unilateral load modes multiply by 2.
