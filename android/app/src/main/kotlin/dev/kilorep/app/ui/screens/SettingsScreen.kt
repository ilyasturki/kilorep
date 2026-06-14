package dev.kilorep.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.kilorep.app.BuildConfig
import dev.kilorep.app.data.Repo
import dev.kilorep.app.data.Settings
import dev.kilorep.app.data.SyncStatus
import dev.kilorep.app.ui.components.ConfirmDialog
import dev.kilorep.app.ui.components.GhostButton
import dev.kilorep.app.ui.components.Kicker
import dev.kilorep.app.ui.components.LiftCard
import dev.kilorep.app.ui.components.LiftScreen
import dev.kilorep.app.ui.components.Tag
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text
import dev.kilorep.app.ui.watch
import kotlinx.coroutines.launch

/**
 * Instance, identity, sync. Device tokens are revoked from the web settings;
 * this screen owns this install's credential only.
 */
@Composable
fun SettingsScreen(
    settings: Settings,
    repo: Repo,
    offline: Boolean,
    onBack: (() -> Unit)?,
) {
    val appSettings = settings.flow.watch()
    val drafts = repo.drafts.watch()
    val syncStatus = repo.syncStatus.watch()
    val scope = rememberCoroutineScope()
    val colors = Lift.colors
    var confirmSignOut by remember { mutableStateOf(false) }
    var confirmSwitch by remember { mutableStateOf(false) }

    LiftScreen(title = "Settings", onBack = onBack, offline = offline) {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            LiftCard(padding = 14.dp) {
                Kicker("Server")
                Text(
                    appSettings.serverUrl ?: "Not connected",
                    style = LiftType.mono,
                    modifier = Modifier.padding(top = 6.dp),
                )
                Row(
                    Modifier.padding(top = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    Tag(if (appSettings.authEnabled) "Multi-user" else "Single-user")
                    Tag(if (offline) "Offline" else "Online", accent = !offline)
                }
                GhostButton(
                    "Switch server",
                    onClick = { confirmSwitch = true },
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                    height = 40.dp,
                )
            }

            LiftCard(padding = 14.dp) {
                Kicker("Sync")
                val dirty = drafts.count { it.dirty }
                Text(
                    when {
                        dirty == 0 -> "Everything is on the server."
                        dirty == 1 -> "1 workout waiting to sync."
                        else -> "$dirty workouts waiting to sync."
                    },
                    style = LiftType.secondary,
                    color = colors.ink2,
                    modifier = Modifier.padding(top = 6.dp),
                )
                syncStatus.values.filterIsInstance<SyncStatus.Error>().firstOrNull()?.let {
                    Text(
                        it.reason,
                        style = LiftType.secondary,
                        color = colors.danger,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                GhostButton(
                    "Sync now",
                    onClick = { scope.launch { repo.syncNow() } },
                    icon = LiftIcons.Refresh,
                    enabled = !offline && dirty > 0,
                    modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                    height = 40.dp,
                )
            }

            if (appSettings.authEnabled) {
                LiftCard(padding = 14.dp) {
                    Kicker("This device")
                    Text(
                        "Signed in with a device token. Manage or revoke every " +
                            "device from the web app's settings.",
                        style = LiftType.secondary,
                        color = colors.ink2,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                    GhostButton(
                        "Sign out",
                        onClick = { confirmSignOut = true },
                        icon = LiftIcons.Logout,
                        danger = true,
                        modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                        height = 40.dp,
                    )
                }
            }

            Text(
                "Kilorep Android ${BuildConfig.VERSION_NAME}",
                style = LiftType.tag,
                color = colors.ink3,
                modifier = Modifier.padding(top = 6.dp, bottom = 16.dp),
            )
        }
    }

    if (confirmSignOut) {
        ConfirmDialog(
            title = "Sign out?",
            body = "Unsynced workouts on this phone are deleted with the account data.",
            confirmLabel = "Sign out",
            danger = true,
            onConfirm = {
                scope.launch {
                    repo.clearLocalData()
                    settings.clearToken()
                }
                confirmSignOut = false
            },
            onDismiss = { confirmSignOut = false },
        )
    }

    if (confirmSwitch) {
        ConfirmDialog(
            title = "Switch server?",
            body = "Everything cached from this instance — unsynced workouts included — is wiped.",
            confirmLabel = "Switch",
            danger = true,
            onConfirm = {
                scope.launch {
                    repo.clearLocalData()
                    settings.reset()
                }
                confirmSwitch = false
            },
            onDismiss = { confirmSwitch = false },
        )
    }
}
