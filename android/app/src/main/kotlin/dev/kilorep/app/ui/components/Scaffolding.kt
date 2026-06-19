package dev.kilorep.app.ui.components

import android.view.HapticFeedbackConstants
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcon
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text

/**
 * Screen frame: bg fill, status-bar inset, optional top bar. Content is the
 * caller's; the bottom bar belongs to the nav shell, not here.
 */
@Composable
fun LiftScreen(
    title: String? = null,
    onBack: (() -> Unit)? = null,
    actions: (@Composable () -> Unit)? = null,
    offline: Boolean = false,
    content: @Composable () -> Unit,
) {
    val colors = Lift.colors
    Column(
        Modifier
            .fillMaxSize()
            .background(colors.bg)
            .statusBarsPadding(),
    ) {
        if (offline) {
            Box(
                Modifier
                    .fillMaxWidth()
                    .background(colors.surface2)
                    .padding(vertical = 6.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    "OFFLINE — LOGGING LOCALLY",
                    style = LiftType.tag,
                    color = colors.ink2,
                )
            }
        }
        if (title != null) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp)
                    .height(56.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                if (onBack != null) {
                    Box(
                        Modifier
                            .size(44.dp)
                            .clickable(onClick = onBack),
                        contentAlignment = Alignment.Center,
                    ) {
                        LiftIcon(LiftIcons.ChevronLeft, tint = colors.ink2)
                    }
                }
                Text(
                    title,
                    modifier = Modifier
                        .weight(1f)
                        .padding(start = if (onBack == null) 10.dp else 0.dp),
                    style = LiftType.heading,
                    maxLines = 1,
                )
                if (actions != null) actions()
            }
        }
        Box(Modifier.weight(1f)) { content() }
    }
}

data class BottomTab(
    val route: String,
    val label: String,
    val icon: ImageVector,
)

@Composable
fun LiftBottomBar(
    tabs: List<BottomTab>,
    currentRoute: String?,
    onSelect: (String) -> Unit,
) {
    val colors = Lift.colors
    Column(Modifier.background(colors.bg)) {
        Box(
            Modifier
                .fillMaxWidth()
                .height(1.dp)
                .background(colors.line),
        )
        Row(
            Modifier
                .fillMaxWidth()
                .navigationBarsPadding()
                .height(60.dp),
        ) {
            tabs.forEach { tab ->
                val selected = currentRoute == tab.route
                Column(
                    Modifier
                        .weight(1f)
                        .fillMaxSize()
                        .clickable { onSelect(tab.route) },
                    verticalArrangement = Arrangement.spacedBy(
                        3.dp,
                        Alignment.CenterVertically,
                    ),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    LiftIcon(
                        tab.icon,
                        tint = if (selected) colors.accentText else colors.ink3,
                        size = 21.dp,
                    )
                    Text(
                        tab.label.uppercase(),
                        style = LiftType.tag,
                        color = if (selected) colors.accentText else colors.ink3,
                    )
                }
            }
        }
    }
}

/**
 * The gym loop's done-tick: a 44dp bordered square that fills volt when
 * done, confirming with a haptic so the lifter feels it without reading
 * the screen.
 */
@Composable
fun DoneTick(
    done: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = Lift.colors
    val view = LocalView.current
    Box(
        modifier = modifier
            .size(52.dp)
            .background(if (done) colors.accent else colors.surface)
            .border(1.dp, if (done) colors.accent else colors.line2)
            .clickable {
                @Suppress("DEPRECATION")
                view.performHapticFeedback(
                    if (android.os.Build.VERSION.SDK_INT >= 30) {
                        HapticFeedbackConstants.CONFIRM
                    } else {
                        HapticFeedbackConstants.VIRTUAL_KEY
                    },
                )
                onToggle()
            },
        contentAlignment = Alignment.Center,
    ) {
        LiftIcon(
            LiftIcons.Check,
            tint = if (done) colors.accentInk else colors.ink3,
            size = 22.dp,
        )
    }
}

/** Square-cornered modal card shell, Lift-skinned — the surround shared by the app's custom dialogs. */
@Composable
fun LiftDialogCard(
    onDismiss: () -> Unit,
    content: @Composable ColumnScope.() -> Unit,
) {
    val colors = Lift.colors
    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .background(colors.surface)
                .border(1.dp, colors.line2)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
            content = content,
        )
    }
}

/** Square-cornered modal confirm, Lift-skinned. */
@Composable
fun ConfirmDialog(
    title: String,
    body: String?,
    confirmLabel: String,
    onConfirm: () -> Unit,
    onDismiss: () -> Unit,
    danger: Boolean = false,
) {
    val colors = Lift.colors
    Dialog(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .background(colors.surface)
                .border(1.dp, colors.line2)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            Text(title, style = LiftType.rowTitle, fontWeight = FontWeight.W700)
            if (body != null) {
                Text(body, style = LiftType.secondary, color = colors.ink2)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                GhostButton("Cancel", onDismiss, Modifier.weight(1f))
                if (danger) {
                    DangerButton(confirmLabel, onConfirm, Modifier.weight(1f))
                } else {
                    PrimaryButton(confirmLabel, onConfirm, Modifier.weight(1f))
                }
            }
        }
    }
}

/** Full-screen Lift-skinned picker shell (exercise picker, merge target…). */
@Composable
fun FullScreenDialog(
    title: String,
    onDismiss: () -> Unit,
    content: @Composable () -> Unit,
) {
    val colors = Lift.colors
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false),
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .background(colors.bg)
                .statusBarsPadding()
                .navigationBarsPadding()
                .imePadding(),
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(56.dp)
                    .padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    Modifier
                        .size(44.dp)
                        .clickable(onClick = onDismiss),
                    contentAlignment = Alignment.Center,
                ) {
                    LiftIcon(LiftIcons.X, tint = colors.ink2)
                }
                Text(title, style = LiftType.heading, maxLines = 1)
            }
            Box(Modifier.weight(1f)) { content() }
        }
    }
}
