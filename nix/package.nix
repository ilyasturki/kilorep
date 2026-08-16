{
  lib,
  stdenv,
  bun,
  nodejs-slim_24,
  makeWrapper,
}:

let
  # Pinned: `node:sqlite` is the database driver, so the major must not move silently.
  nodejs = nodejs-slim_24;
  packageJSON = lib.importJSON ../package.json;

  manifest = lib.fileset.unions [
    ../package.json
    ../bun.lock
  ];

  appSources = lib.fileset.difference ../src (
    lib.fileset.unions [
      ../src/routes/dev
      (lib.fileset.fileFilter (file: lib.hasInfix ".test." file.name) ../src)
    ]
  );

  # `outputHash` must be refreshed whenever bun.lock or package.json change: `bun run nix:deps-hash`.
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
    outputHash = "sha256-uH1AFcSwtrAnhdajD9TXdNOmPpKBTmfTwdJT9pk7Irw=";
  };
in
stdenv.mkDerivation {
  pname = packageJSON.name;
  inherit (packageJSON) version;

  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      manifest
      ../tsconfig.json
      ../vite.config.ts
      appSources
      ../static
      ../drizzle
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

    node node_modules/.bin/svelte-kit sync

    # Node, not bun: the prerender loads the server bundle, and bun has no `node:sqlite`.
    node node_modules/.bin/vite build

    # `adapter-node` externalises its dependencies, so bundling is what lets the
    # output run without a node_modules beside it.
    bun build --target=node --outdir=build/bundled build/server/index.js

    bun build --target=node --outfile=account.js scripts/account.ts

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p "$out/share/kilorep/server"
    cp -R build/bundled/. "$out/share/kilorep/server/"

    cp -R build/server/client "$out/share/kilorep/server/client"
    cp -R build/server/prerendered "$out/share/kilorep/server/prerendered"

    cp -R drizzle "$out/share/kilorep/drizzle"
    cp account.js "$out/share/kilorep/account.js"

    # bun emits ESM; without this Node reads both bare `.js` entry points as CommonJS.
    echo '{"type":"module"}' > "$out/share/kilorep/package.json"

    makeWrapper "${nodejs}/bin/node" "$out/bin/kilorep" \
      --add-flags "$out/share/kilorep/server/index.js" \
      --set-default MIGRATIONS_DIR "$out/share/kilorep/drizzle"

    makeWrapper "${nodejs}/bin/node" "$out/bin/kilorep-account" \
      --add-flags "$out/share/kilorep/account.js" \
      --set-default MIGRATIONS_DIR "$out/share/kilorep/drizzle"

    runHook postInstall
  '';

  passthru.deps = deps;

  meta = {
    description = "Workout logging and body weight tracker";
    mainProgram = "kilorep";
    platforms = [ "x86_64-linux" ];
  };
}
