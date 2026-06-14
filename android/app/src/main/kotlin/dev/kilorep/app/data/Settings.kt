package dev.kilorep.app.data

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Where this install points and who it is. The device token is the only
 * secret and lives in Keystore-backed EncryptedSharedPreferences;
 * the server URL and probed auth mode are plain preferences.
 */
data class AppSettings(
    val serverUrl: String?,
    val authEnabled: Boolean,
    val deviceToken: String?,
) {
    /** Onboarded = a server to talk to, plus a credential when one is needed. */
    val ready: Boolean
        get() = serverUrl != null && (!authEnabled || deviceToken != null)
}

interface Settings {
    val flow: StateFlow<AppSettings>
    val current: AppSettings

    fun connect(serverUrl: String, authEnabled: Boolean)
    fun storeToken(token: String)

    /** Sign-out or revocation: drop the credential, keep the server. */
    fun clearToken()

    /** Full reset — switching instances wipes identity along with the URL. */
    fun reset()
}

class AndroidSettings(context: Context) : Settings {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("kilorep", Context.MODE_PRIVATE)

    private val secrets: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "kilorep-secrets",
        MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
    )

    private val state = MutableStateFlow(load())
    override val flow: StateFlow<AppSettings> get() = state

    override val current: AppSettings get() = state.value

    private fun load() = AppSettings(
        serverUrl = prefs.getString("serverUrl", null),
        authEnabled = prefs.getBoolean("authEnabled", false),
        deviceToken = secrets.getString("deviceToken", null),
    )

    override fun connect(serverUrl: String, authEnabled: Boolean) {
        prefs.edit {
            putString("serverUrl", serverUrl.trimEnd('/'))
            putBoolean("authEnabled", authEnabled)
        }
        state.value = load()
    }

    override fun storeToken(token: String) {
        secrets.edit { putString("deviceToken", token) }
        state.value = load()
    }

    override fun clearToken() {
        secrets.edit { remove("deviceToken") }
        state.value = load()
    }

    override fun reset() {
        prefs.edit { clear() }
        secrets.edit { clear() }
        state.value = load()
    }
}
