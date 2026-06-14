package dev.kilorep.app

import android.content.Context
import dev.kilorep.app.data.AndroidSettings
import dev.kilorep.app.data.Backend
import dev.kilorep.app.data.Connectivity
import dev.kilorep.app.data.JsonStore
import dev.kilorep.app.data.Repo
import dev.kilorep.app.data.SyncWorker
import java.io.File
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/** Manual DI — the object graph is small enough to read in one screen. */
class AppContainer(private val context: Context) {

    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    val settings = AndroidSettings(context)

    val backend = Backend(
        settings,
        // A 401 with our token = revoked from web settings: drop the
        // credential so the UI falls back to sign-in immediately.
        onAuthRejected = { settings.clearToken() },
    )

    val repo = Repo(
        backend = backend,
        files = JsonStore(File(context.filesDir, "store")),
        onDirtyDrafts = { SyncWorker.schedule(context) },
    )

    val connectivity = Connectivity(context)

    init {
        // Opportunistic foreground sync the moment connectivity returns;
        // WorkManager covers the app-killed case.
        scope.launch {
            connectivity.online.collect { online ->
                if (online && repo.drafts.value.any { it.dirty }) {
                    repo.syncNow()
                }
            }
        }
    }
}
