# Kilorep Android

Native Kotlin/Compose client — the gym-first surface (see `docs/adr/0001`,
issue #1). The web app stays the desktop surface; this app owns the gym loop
(start → log → swap → finish) and works fully offline, syncing finished
workouts by replay (create-then-PUT, last writer wins).

## Layout

- `:api` — Kotlin client + models **generated at build time** from
  `../openapi/kilorep.json` (the committed contract exported from the Nitro
  route metas with `bun run openapi:export`). Never edit generated code; fix
  the route meta and re-export instead.
- `:app` — the Compose app. The Lift design identity is recreated in
  `ui/theme/` (ADR-0003) — no Material theming, no dynamic color. The
  offline draft store + sync engine live in `store/` as pure Kotlin, tested
  by plain JVM unit tests.

## Build

Any JDK 17+ plus the Android SDK (build-tools 35.0.0, platform 35):

```sh
./gradlew :app:assembleDebug          # debug APK
./gradlew :app:testDebugUnitTest      # sync engine + draft + ViewModel tests
./gradlew :api:compileKotlin          # just the generated client (CI contract check)
```

### On NixOS

Prebuilt SDK binaries don't run on NixOS; use the nixpkgs SDK (defined once in
`nix/sdk.nix`) and point Gradle at its patched aapt2:

```sh
nix build --impure --expr "import $PWD/nix/sdk.nix" -o .nix-android-sdk

echo "sdk.dir=$PWD/.nix-android-sdk/libexec/android-sdk" > local.properties

./gradlew :app:assembleDebug \
  "-Pandroid.aapt2FromMavenOverride=$PWD/.nix-android-sdk/libexec/android-sdk/build-tools/35.0.0/aapt2"
```

Any JDK 17+ on PATH works (e.g. `nixpkgs#jdk`); the aapt2 override can live
in `~/.gradle/gradle.properties` to make bare `./gradlew` invocations work.

## Release

CI (`.github/workflows/android-release.yml`) builds a signed APK on every
`android-v*` tag and attaches it to a GitHub Release — Obtainium installs
and updates from there. Signing comes from repo secrets
(`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`); without them a local `assembleRelease` falls back
to the debug key so the APK stays installable.

Bump `versionCode`/`versionName` in `app/build.gradle.kts` with each tag.

## Auth

Onboarding probes `GET /api/auth/mode`: single-user instances skip sign-in
entirely; multi-user instances sign in through the system account picker
(Credential Manager) using the `googleClientId` the probe returns, and
exchange the ID token for a `kr_…` device token at `POST /api/auth/device`
(ADR-0002). The token lives in Keystore-backed EncryptedSharedPreferences
and is revocable from the web settings' token list — a 401 on any call
drops it and returns the app to sign-in.
