package dev.kilorep.app.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.kilorep.api.models.DeviceSignInInput
import dev.kilorep.app.data.Backend
import dev.kilorep.app.data.Repo
import dev.kilorep.app.data.Settings
import dev.kilorep.app.data.userMessage
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

sealed interface OnboardingStep {
    /** Enter (or correct) the instance URL. */
    data object Server : OnboardingStep

    /** Auth-mode instance: pick the Google account. */
    data class SignIn(val serverUrl: String, val googleClientId: String) : OnboardingStep

    data object Done : OnboardingStep
}

/**
 * Server-first onboarding: probe `/api/auth/mode`, then either skip sign-in
 * entirely (self-hosted single-user) or exchange a Credential Manager ID
 * token for a device token (ADR-0002). The Google account picker itself is
 * platform UI and stays in the composable; this holds everything testable.
 */
class OnboardingViewModel(
    private val settings: Settings,
    private val backend: Backend,
    private val repo: Repo,
) : ViewModel() {

    val step = MutableStateFlow<OnboardingStep>(OnboardingStep.Server)
    val busy = MutableStateFlow(false)
    val error = MutableStateFlow<String?>(null)

    /** Pre-filled when re-onboarding after a revoked token. */
    val initialUrl: String get() = settings.current.serverUrl ?: ""

    fun probe(rawUrl: String) {
        val url = normalize(rawUrl) ?: run {
            error.value = "Enter the server address"
            return
        }
        busy.value = true
        error.value = null
        viewModelScope.launch {
            try {
                val mode = withContext(Dispatchers.IO) { backend.authAt(url).getAuthMode() }
                if (!mode.authEnabled) {
                    connect(url, authEnabled = false)
                } else {
                    val clientId = mode.googleClientId
                    if (clientId == null) {
                        error.value = "Server reports auth without a Google client id"
                    } else {
                        step.value = OnboardingStep.SignIn(url, clientId)
                    }
                }
            } catch (e: CancellationException) {
                // Cancellation (rotation, scope teardown) is not a failure.
                throw e
            } catch (e: Exception) {
                error.value = "Could not reach the server (${e.userMessage()})"
            } finally {
                busy.value = false
            }
        }
    }

    /** Called with the ID token the system account picker produced. */
    fun signIn(serverUrl: String, idToken: String, deviceName: String) {
        busy.value = true
        error.value = null
        viewModelScope.launch {
            try {
                val grant = withContext(Dispatchers.IO) {
                    backend.authAt(serverUrl)
                        .deviceSignIn(DeviceSignInInput(idToken, deviceName))
                }
                // A fresh credential can mean a different account: anything
                // cached — drafts included — must not bleed into it, let
                // alone sync into it. Revoke-then-relogin accepts the loss.
                repo.clearLocalData()
                settings.storeToken(grant.token)
                connect(serverUrl, authEnabled = true)
            } catch (e: CancellationException) {
                // Cancellation (rotation, scope teardown) is not a failure.
                throw e
            } catch (e: Exception) {
                error.value = e.userMessage()
            } finally {
                busy.value = false
            }
        }
    }

    fun signInFailed(reason: String) {
        error.value = reason
    }

    fun backToServer() {
        step.value = OnboardingStep.Server
        error.value = null
    }

    private suspend fun connect(url: String, authEnabled: Boolean) {
        val switching = settings.current.serverUrl != null && settings.current.serverUrl != url
        settings.connect(url, authEnabled)
        // Identity or instance changed: cached data belongs to someone else.
        if (switching) repo.clearLocalData()
        repo.refreshAll()
        step.value = OnboardingStep.Done
    }

    private fun normalize(raw: String): String? {
        val trimmed = raw.trim().trimEnd('/')
        if (trimmed.isEmpty()) return null
        return if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
            trimmed
        } else {
            "https://$trimmed"
        }
    }
}
