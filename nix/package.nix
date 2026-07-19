{
  lib,
  stdenv,
  bun2nix,
  nodejs_24,
  python3,
  node-gyp,
  makeWrapper,
  autoPatchelfHook,
  src,
  gitRev,
}:
let
  # The same node is used to compile the native addon and to run the server,
  # so the better-sqlite3 ABI matches at runtime.
  nodejs = nodejs_24;
in
stdenv.mkDerivation {
  pname = "kilorep";
  # Single source of truth: track the app version declared in package.json.
  version = (lib.importJSON ../package.json).version;

  inherit src;

  nativeBuildInputs = [
    bun2nix.hook # recreates node_modules from bunDeps before the build
    nodejs
    python3 # node-gyp needs python
    node-gyp
    makeWrapper
    autoPatchelfHook # relink the compiled .node against nixpkgs libs
  ];

  buildInputs = [ stdenv.cc.cc.lib ];

  bunDeps = bun2nix.fetchBunDeps {
    bunNix = ./bun.nix;
  };

  env = {
    # node-server is Nitro's default, but pin it so the sandbox build is
    # deterministic regardless of auto-detection.
    NITRO_PRESET = "node-server";
    NUXT_TELEMETRY_DISABLED = "1";
    DO_NOT_TRACK = "1";
    # Baked into runtimeConfig.gitRev so a deployed instance can say which
    # commit it is running (/api/_version); .git is not in the build source.
    KILOREP_GIT_REV = gitRev;
  };

  buildPhase = ''
    runHook preBuild

    export HOME=$(mktemp -d)

    # bun2nix recreates node_modules but does not run package install scripts,
    # so better-sqlite3's prebuilt .node is absent. Compile it from source
    # (the package vendors its own SQLite amalgamation) against this nodejs.
    pushd node_modules/better-sqlite3 > /dev/null
    node-gyp rebuild --release --nodedir=${nodejs}
    popd > /dev/null

    bun run build

    runHook postBuild
  '';

  installPhase = ''
    runHook preInstall

    mkdir -p $out/share/kilorep
    cp -R .output/. $out/share/kilorep/

    # The migrate plugin loads these SQL files from disk at startup; Nitro's
    # bundle does not include the server source tree, so ship a copy and point
    # the service at it via DB_MIGRATIONS_DIR.
    cp -R server/database/migrations $out/share/kilorep/migrations

    # Nitro traces better-sqlite3, but its .node is loaded dynamically and can
    # be missed by the tracer; guarantee it lands in the output.
    bsRelease=$out/share/kilorep/server/node_modules/better-sqlite3/build/Release
    if [ ! -e "$bsRelease/better_sqlite3.node" ]; then
      mkdir -p "$bsRelease"
      cp node_modules/better-sqlite3/build/Release/better_sqlite3.node "$bsRelease/"
    fi

    makeWrapper ${nodejs}/bin/node $out/bin/kilorep \
      --add-flags "$out/share/kilorep/server/index.mjs" \
      --set-default DB_MIGRATIONS_DIR "$out/share/kilorep/migrations"

    runHook postInstall
  '';

  meta = {
    description = "Kilorep — minimalist workout session & weight tracker (Nuxt server)";
    mainProgram = "kilorep";
    platforms = lib.platforms.linux;
  };
}
