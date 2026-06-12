# Android app lives in the kilorep monorepo under android/

The Compose app, the OpenAPI spec, and the Kotlin client codegen live in the
same repo as the Nitro routes they mirror, so an API change and its client
regeneration land in one commit and contract drift between the two clients
has nowhere to hide. The costs accepted: the nix server packaging must exclude
`android/`, and Gradle joins bun in the repo toolchain.
