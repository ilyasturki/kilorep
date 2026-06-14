# Moshi deserializes the generated API models and the on-device stores via
# Kotlin reflection (KotlinJsonAdapterFactory) — their shape must survive R8.
-keep class dev.kilorep.api.models.** { *; }
-keep class dev.kilorep.app.store.** { *; }
-keep class kotlin.Metadata { *; }
-keep class kotlin.reflect.jvm.internal.** { *; }
-keepattributes Signature, InnerClasses, EnclosingMethod, *Annotation*

-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
