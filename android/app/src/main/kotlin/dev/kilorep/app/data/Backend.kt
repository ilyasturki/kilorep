package dev.kilorep.app.data

import dev.kilorep.api.apis.AccountApi
import dev.kilorep.api.apis.AuthApi
import dev.kilorep.api.apis.BodyweightApi
import dev.kilorep.api.apis.ExercisesApi
import dev.kilorep.api.apis.SessionsApi
import dev.kilorep.api.apis.WorkoutsApi
import dev.kilorep.api.infrastructure.ClientError
import dev.kilorep.api.infrastructure.ClientException
import dev.kilorep.api.infrastructure.ServerError
import dev.kilorep.api.infrastructure.ServerException
import dev.kilorep.app.store.SyncException
import java.io.IOException
import java.util.concurrent.TimeUnit
import okhttp3.OkHttpClient

/**
 * Builds the generated APIs against the configured instance, with the device
 * token as bearer auth. APIs are cheap value objects over the one shared
 * OkHttp client, so they're rebuilt per access and always see the current
 * server URL.
 */
class Backend(
    private val settings: Settings,
    private val onAuthRejected: () -> Unit,
) {
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .writeTimeout(20, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val token = settings.current.deviceToken
            val request =
                if (token != null) {
                    chain.request().newBuilder()
                        .header("Authorization", "Bearer $token")
                        .build()
                } else {
                    chain.request()
                }
            val response = chain.proceed(request)
            // A 401 with a token attached means the device was revoked from
            // web settings — revocation must be real on the next call. But
            // only when the 401 came from kilorep's own auth layer: Nitro
            // errors are always application/json, while captive portals and
            // reverse proxies answer in HTML — dropping the token on those
            // would funnel the user into sign-in and wipe unsynced drafts.
            val fromKilorepAuth = response.header("Content-Type")
                ?.contains("application/json", ignoreCase = true) == true
            if (response.code == 401 && token != null && fromKilorepAuth) onAuthRejected()
            response
        }
        .build()

    private fun base(): String =
        settings.current.serverUrl ?: throw SyncException("No server configured", retryable = false)

    /** For onboarding, before a server is stored. */
    fun authAt(serverUrl: String) = AuthApi(serverUrl.trimEnd('/'), client)

    val auth get() = AuthApi(base(), client)
    val workouts get() = WorkoutsApi(base(), client)
    val sessions get() = SessionsApi(base(), client)
    val exercises get() = ExercisesApi(base(), client)
    val bodyweight get() = BodyweightApi(base(), client)
    val account get() = AccountApi(base(), client)
}

/** The server's error payloads put the human-readable cause in `message`. */
private val messageField = Regex("\"message\"\\s*:\\s*\"([^\"]+)\"")

fun Throwable.userMessage(): String = when (this) {
    // The generated client keeps the response body on the error response
    // object (the exception's own message is just "Client error : <code>"),
    // so the server's message has to be dug out of there.
    is ClientException ->
        ((response as? ClientError<*>)?.body as? String)
            ?.let { messageField.find(it)?.groupValues?.get(1) }
            ?: "Request failed ($statusCode)"
    is ServerException ->
        ((response as? ServerError<*>)?.body as? String)
            ?.let { messageField.find(it)?.groupValues?.get(1) }
            ?: "Server error"
    is IOException -> "No connection"
    is SyncException -> message ?: "Sync failed"
    else -> message ?: "Something went wrong"
}

fun Throwable.statusCodeOrNull(): Int? = when (this) {
    is ClientException -> statusCode
    is ServerException -> statusCode
    else -> null
}

/**
 * Classifies a failure for the replay queue: connectivity and server blips
 * retry when the network returns; 4xx means the payload or its target is
 * wrong and retrying cannot fix it.
 */
fun Throwable.toSyncException(): SyncException = when (this) {
    is SyncException -> this
    is IOException -> SyncException("No connection", retryable = true, cause = this)
    is ServerException -> SyncException("Server error", retryable = true, cause = this)
    is ClientException -> SyncException(userMessage(), retryable = false, cause = this)
    else -> SyncException(userMessage(), retryable = true, cause = this)
}
