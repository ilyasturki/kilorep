# AGENTS.md

Workout session manager for gym and weight tracker. Simple and minimalist.

# Stack

- Nuxt 4, Vue 3, TypeScript
- Tailwind CSS 4
- Bun as package manager
- UI components : NuxtUI
- hosted on nixos vps
- (later) native android mobile app that will use the nitro backend

# Deployment

- Migrations apply automatically at server startup (dev and prod) via
  `server/plugins/migrate.ts`, using the `drizzle-orm` runtime migrator.
  `drizzle-kit` is only needed at dev time to generate migrations. Keep the
  `server/database/migrations` folder present at runtime, or point
  `DB_MIGRATIONS_DIR` at its absolute path. Set `DB_FILE_NAME` to a persistent
  path on the VPS (defaults to `.data/workout.db` relative to the launch dir).
- `better-sqlite3` is a native addon, so run the server on the **Node** runtime
  (Nitro's default — `nuxt preview` / `node .output/server/index.mjs`), not the
  Bun runtime, which can't load it yet. Bun is the package manager only.
- On NixOS its prebuilt binary often fails to load against the non-FHS glibc, so
  build it from source against the Nix toolchain: with a C/C++ compiler + python
  available, install via `npm_config_build_from_source=true bun install`.
