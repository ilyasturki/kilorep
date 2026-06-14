pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "kilorep"

// :api is the client code-generated from ../openapi/kilorep.json (ADR-0004);
// :app is the Compose application. The sync engine lives in :app as pure
// Kotlin so its tests run as plain JVM unit tests.
include(":api", ":app")
