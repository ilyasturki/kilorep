import groovy.json.JsonOutput
import groovy.json.JsonSlurper
import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlin.jvm)
    alias(libs.plugins.openapi.generator)
}

// Target 17 bytecode (what :app dexes) without pinning a toolchain — Gradle
// can't auto-detect nix-store JDKs, so the build runs on any ambient JDK >=17.
kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}
java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

val specFile = rootProject.layout.projectDirectory.file("../openapi/kilorep.json")
val codegenSpec = layout.buildDirectory.file("openapi/codegen-spec.json")

/**
 * The committed contract models "object or null" 3.1-style as
 * `anyOf: [$ref, {type: null}]`, which openapi-generator turns into an
 * unusable union class. A nullable non-required `$ref` generates the right
 * Kotlin (`val template: TemplateStatus? = null`) and deserializes JSON null
 * identically, so rewrite just for generation — the contract itself stays
 * exact for response validation.
 */
val prepareCodegenSpec by tasks.registering {
    inputs.file(specFile)
    outputs.file(codegenSpec)
    doLast {
        @Suppress("UNCHECKED_CAST")
        fun simplify(node: Any?): Any? = when (node) {
            is Map<*, *> -> {
                val map = node as Map<String, Any?>
                val anyOf = map["anyOf"] as? List<Map<String, Any?>>
                val refBranch = anyOf?.singleOrNull { it.containsKey("\$ref") }
                if (anyOf != null && anyOf.size == 2 && refBranch != null &&
                    anyOf.any { it["type"] == "null" }
                ) {
                    mapOf("\$ref" to refBranch["\$ref"])
                } else {
                    map.mapValues { (key, value) ->
                        if (key == "required" && value is List<*>) {
                            val props = map["properties"] as? Map<String, Any?>
                            value.filter { name ->
                                val schema = props?.get(name) as? Map<String, Any?>
                                val propAnyOf = schema?.get("anyOf") as? List<Map<String, Any?>>
                                propAnyOf == null || propAnyOf.none { it["type"] == "null" }
                            }
                        } else {
                            simplify(value)
                        }
                    }
                }
            }
            is List<*> -> node.map { simplify(it) }
            else -> node
        }

        val spec = JsonSlurper().parse(specFile.asFile) as Map<String, Any?>
        val out = codegenSpec.get().asFile
        out.parentFile.mkdirs()
        out.writeText(JsonOutput.prettyPrint(JsonOutput.toJson(simplify(spec))))
    }
}

openApiGenerate {
    generatorName.set("kotlin")
    inputSpec.set(codegenSpec.map { it.asFile.absolutePath })
    outputDir.set(layout.buildDirectory.dir("openapi/generated").map { it.asFile.absolutePath })
    packageName.set("dev.kilorep.api")
    library.set("jvm-okhttp4")
    configOptions.set(
        mapOf(
            "dateLibrary" to "java8",
            "useSettingsGradle" to "false",
            "omitGradlePluginVersions" to "true",
            "omitGradleWrapper" to "true",
        ),
    )
    // Loads are plain kilogram doubles, not money.
    typeMappings.set(mapOf("number" to "kotlin.Double"))
    // "entries" is reserved in the Kotlin generator (escapes to the unsightly
    // propertyEntries); mapping it explicitly bypasses the escape.
    nameMappings.set(mapOf("entries" to "entries"))
    // The generated build files are unused — sources are compiled by this
    // module — but docs/tests would still churn the build dir for nothing.
    generateApiDocumentation.set(false)
    generateModelDocumentation.set(false)
}

tasks.named("openApiGenerate") { dependsOn(prepareCodegenSpec) }

sourceSets {
    main {
        kotlin.srcDir(layout.buildDirectory.dir("openapi/generated/src/main/kotlin"))
    }
}

tasks.named("compileKotlin") { dependsOn("openApiGenerate") }
tasks.matching { it.name == "sourcesJar" || it.name == "kotlinSourcesJar" }
    .configureEach { dependsOn("openApiGenerate") }

dependencies {
    api(libs.okhttp)
    api(libs.moshi.kotlin)
    api(libs.moshi.adapters)
    implementation(libs.kotlin.reflect)
}
