Workout session manager for gym and weight tracker. Simple and minimalist, no fioriture.

# Stack

- Nuxt 4, Vue 3, TypeScript
- Tailwind CSS 4
- Bun as package manager
- UI components : reka-ui (Lift design system — tokens + component classes in app/assets/css/main.css, ui wrappers in app/components/ui)
- hosted on nixos vps
- (later) native android mobile app that will use the nitro backend

# Dev server

A dev server is usually already running on http://localhost:4001. To verify changes, reuse it (HMR has already picked up edits) — `curl localhost:4001` or open it in the browser. Do NOT kill the process on port 4001 or start a competing `nuxt dev`. If you need an isolated instance, start one on a different port (e.g. `nuxt dev --port 4099`).

# Code quality

Comments explain _why_, never _what_. Only add a comment when the rationale is non-obvious (a gotcha, a timing constraint, a security trade-off). Do not add comments that restate what the code or option names already make clear.
