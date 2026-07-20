package dev.kilorep.app.ui.components

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcon
import dev.kilorep.app.ui.theme.LiftIcons

/**
 * ≡ grip that starts a drag the moment it's touched (no long-press) — the
 * touch replacement for the web's up/down MoveButtons. Pass the reorderable
 * scope's `draggableHandle` modifier from the call site. TalkBack users
 * can't drag, so explicit moves survive as accessibility custom actions.
 */
@Composable
fun DragHandle(
    modifier: Modifier = Modifier,
    size: Dp = 38.dp,
    onMoveUp: (() -> Unit)? = null,
    onMoveDown: (() -> Unit)? = null,
) {
    val colors = Lift.colors
    Box(
        modifier = modifier
            .size(size)
            .border(1.dp, colors.line)
            .semantics {
                customActions = listOfNotNull(
                    onMoveUp?.let { CustomAccessibilityAction("Move up") { it(); true } },
                    onMoveDown?.let { CustomAccessibilityAction("Move down") { it(); true } },
                )
            },
        contentAlignment = Alignment.Center,
    ) {
        LiftIcon(LiftIcons.GripVertical, tint = colors.ink2, size = 17.dp)
    }
}
