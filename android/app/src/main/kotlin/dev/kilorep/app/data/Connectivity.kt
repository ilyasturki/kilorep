package dev.kilorep.app.data

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/**
 * Live online/offline signal: drives the offline bar and the opportunistic
 * sync kick when connectivity returns mid-session.
 */
class Connectivity(context: Context) {
    private val manager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val _online = MutableStateFlow(isOnlineNow())
    val online: StateFlow<Boolean> get() = _online

    init {
        manager.registerNetworkCallback(
            NetworkRequest.Builder()
                .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
                // Without VALIDATED a captive portal counts as online and
                // sync fires straight into the portal's login page.
                .addCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
                .build(),
            object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    _online.value = true
                }

                override fun onLost(network: Network) {
                    _online.value = isOnlineNow()
                }
            },
        )
    }

    private fun isOnlineNow(): Boolean {
        val capabilities =
            manager.getNetworkCapabilities(manager.activeNetwork) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
            capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }
}
