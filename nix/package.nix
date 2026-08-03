{
  lib,
  stdenv,
  bun,
  nodejs-slim_24,
  makeWrapper,
}:

let
  # Pinned rather than `nodejs`: `node:sqlite` is the database driver, and a
  # nixpkgs bump to a new default major would move it with nothing in the diff
  # saying so. 24.18.0 is also what the vitest suite runs on.
  #
  # `-slim` is the same interpreter without npm and corepack, neither of which
  # anything here invokes — bun installs, and both binaries are bundled.
  nodejs = nodejs-slim_24;
  packageJSON = lib.importJSON ../package.json;

  # Shared, because `deps` installs from exactly these two files and the package
  # must rebuild whenever they move. Listing them twice is how the FOD's inputs
  # and the build's inputs drift apart.
  manifest = lib.fileset.unions [
    ../package.json
    ../bun.lock
  ];

  # `src` minus what never reaches the artifact. `routes/dev` is the component
  # playground, and it is a route like any other — leaving it in compiles it into
  # the client bundle, where it is larger than every real route put together. The
  # vitest files are inert, but they rebuild the server on a test-only commit,
  # which is the very thing the allowlist below exists to prevent.
  appSources = lib.fileset.difference ../src (
    lib.fileset.unions [
      ../src/routes/dev
      (lib.fileset.fileFilter (file: lib.hasInfix ".test." file.name) ../src)
    ]
  );

  # Dependencies as a fixed-output derivation. `--ignore-scripts` keeps the
  # closure pure JavaScript so the hash stays stable across machines; nothing
  # here compiles, because the server's only native dependency is a Node builtin.
  # `outputHash` must be refreshed whenever bun.lock or package.json change:
  # run `bun run nix:deps-hash`. CI (.github/workflows/nix-build.yml) fails the
  # build if it goes stale.
  #
  # Build-time only: nothing from here reaches the output, because both binaries
  # are bundled (see buildPhase).
  deps = stdenv.mkDerivation {
    pname = "${packageJSON.name}-deps";
    inherit (packageJSON) version;

    src = lib.fileset.toSource {
      root = ../.;
      fileset = manifest;
    };

    nativeBuildInputs = [ bun ];

    dontConfigure = true;
    dontFixup = true;

    buildPhase = ''
      runHook preBuild
      export HOME="$TMPDIR"
      bun install --frozen-lockfile --ignore-scripts
      runHook postBuild
    '';

    installPhase = ''
      runHook preInstall
      mkdir -p "$out"
      cp -R node_modules "$out/node_modules"
      runHook postInstall
    '';

    outputHashMode = "recursive";
    outputHashAlgo = "sha256";
    outputHash = "sha256-dX5Tb9Ye0voXWAw+6aXFJkY0eTPIBVlHLeP/ua4EfyA=";
  };
in
stdenv.mkDerivation {
  pname = packageJSON.name;
  inherit (packageJSON) version;

  # An allowlist rather than the whole tree: docs/, the lint and test configs and
  # .claude/ have no bearing on the artifact, and including them would rebuild
  # the server on every prose commit.
  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      manifest
      ../tsconfig.json
      ../vite.config.ts
      appSources
      ../static
      # Read from disk at boot by the migrator, so they ship rather than compile in.
      ../drizzle
      # The account CLI's entry point. `scripts/seed.ts` is dev-only and stays out.
      ../scripts/account.ts
    ];
  };

  nativeBuildInputs = [
    bun
    nodejs
    makeWrapper
  ];

  configurePhase = ''
    runHook preConfigure

    cp -R ${deps}/node_modules ./node_modules
    chmod -R u+w ./node_modules
    patchShebangs node_modules

    runHook postConfigure
  '';

  buildPhase = ''
    runHook preBuild

    export HOME="$TMPDIR"
    export NODE_ENV=production

    # `svelte-kit sync` is the package's `prepare` script, which the deps
    # derivation skipped along with every other install script. It writes
    # .svelte-kit/tsconfig.json, and tsconfig.json extends that file — so
    # anything resolving the project's TypeScript config before the sync happens
    # reads a dangling `extends`.
    node node_modules/.bin/svelte-kit sync

    # Under Node, never under Bun. The prerender of the landing page loads the
    # server bundle, which reaches `src/lib/server/db/client.ts` and its
    # `node:sqlite` import — a module Bun does not have, so a bun-driven build
    # fails where a node-driven one does not.
    node node_modules/.bin/vite build

    # `adapter-node` externalises its runtime dependencies rather than inlining
    # them, so its output alone does not run — it expects a node_modules beside
    # it. Bundling the entry point removes that expectation: what comes out
    # imports nothing but node: builtins, which turns a 159 MB dependency tree
    # (most of it build tooling dragged in as peer dependencies, and neither
    # `--production` nor `--omit` will prune it) into one 0.5 MB file.
    bun build --target=node --outdir=build/bundled build/server/index.js

    bun build --target=node --outfile=account.js scripts/account.ts

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p "$out/share/kilorep/server"
    cp -R build/bundled/. "$out/share/kilorep/server/"

    # Served by the bundle, which locates both relative to its own import.meta.url
    # — so they must sit beside it, not where the adapter left them. Unguarded on
    # purpose: the landing page prerenders permanently, so a missing directory is
    # a build that should fail here rather than a server that 404s its own page.
    cp -R build/server/client "$out/share/kilorep/server/client"
    cp -R build/server/prerendered "$out/share/kilorep/server/prerendered"

    cp -R drizzle "$out/share/kilorep/drizzle"
    cp account.js "$out/share/kilorep/account.js"

    # bun emits ESM, and Node reads a bare `.js` as CommonJS unless something says
    # otherwise. Node resolves that from the nearest package.json walking up, so
    # one file here covers both entry points — and any chunk bun decides to split
    # out beside either of them.
    echo '{"type":"module"}' > "$out/share/kilorep/package.json"

    # `--set-default`, so the package is correct on its own — `nix run` in any
    # directory finds the migrations — while a module or an operator can still
    # override it. Everything else the app reads has a working default already.
    makeWrapper "${nodejs}/bin/node" "$out/bin/kilorep" \
      --add-flags "$out/share/kilorep/server/index.js" \
      --set-default MIGRATIONS_DIR "$out/share/kilorep/drizzle"

    makeWrapper "${nodejs}/bin/node" "$out/bin/kilorep-account" \
      --add-flags "$out/share/kilorep/account.js" \
      --set-default MIGRATIONS_DIR "$out/share/kilorep/drizzle"

    runHook postInstall
  '';

  # Exposed so the dependency hash can be refreshed: `nix build .#kilorep.deps`.
  passthru.deps = deps;

  meta = {
    description = "Workout logging and body weight tracker";
    mainProgram = "kilorep";
    platforms = [ "x86_64-linux" ];
  };
}
