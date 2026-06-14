package dev.kilorep.app.ui.screens

import dev.kilorep.app.data.AppSettings
import dev.kilorep.app.data.Settings
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** In-memory Settings for JVM tests — same semantics, no Android storage. */
class FakeSettings(
    serverUrl: String? = null,
    authEnabled: Boolean = false,
    deviceToken: String? = null,
) : Settings {
    private val state = MutableStateFlow(AppSettings(serverUrl, authEnabled, deviceToken))

    override val flow: StateFlow<AppSettings> get() = state
    override val current: AppSettings get() = state.value

    override fun connect(serverUrl: String, authEnabled: Boolean) {
        state.value = state.value.copy(
            serverUrl = serverUrl.trimEnd('/'),
            authEnabled = authEnabled,
        )
    }

    override fun storeToken(token: String) {
        state.value = state.value.copy(deviceToken = token)
    }

    override fun clearToken() {
        state.value = state.value.copy(deviceToken = null)
    }

    override fun reset() {
        state.value = AppSettings(null, false, null)
    }
}
