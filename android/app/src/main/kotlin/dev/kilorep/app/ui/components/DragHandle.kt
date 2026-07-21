package dev.kilorep.app.ui.components

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcon
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text
import sh.calvin.reorderable.ReorderableCollectionItemScope
import sh.calvin.reorderable.ReorderableLazyListState
import sh.calvin.reorderable.rememberReorderableLazyListState

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

/**
 * Reorderable-list state with the Lift haptic convention baked in: a small
 * tick every time the dragged item crosses another. `onMove` receives the
 * two items' lazy keys — resolve them against current state, not captures.
 */
@Composable
fun rememberLiftReorder(
    listState: LazyListState,
    onMove: (fromKey: Any, toKey: Any) -> Unit,
): ReorderableLazyListState {
    val haptics = LocalHapticFeedback.current
    return rememberReorderableLazyListState(listState) { from, to ->
        onMove(from.key, to.key)
        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
    }
}

/**
 * A DragHandle wired for one lazy-list entry: immediate drag with the lift
 * haptic, and Move up/down accessibility actions gated to the entry's
 * position. `onDraggingChange` drives collapse-while-dragging; `onDrop`
 * carries commit-on-drop policies (the sessions list's one API call).
 */
@Composable
fun ReorderableCollectionItemScope.EntryDragHandle(
    index: Int,
    lastIndex: Int,
    onStep: (Int) -> Unit,
    size: Dp = 38.dp,
    onDraggingChange: ((Boolean) -> Unit)? = null,
    onDrop: (() -> Unit)? = null,
) {
    val haptics = LocalHapticFeedback.current
    DragHandle(
        modifier = Modifier.draggableHandle(
            onDragStarted = {
                onDraggingChange?.invoke(true)
                haptics.performHapticFeedback(HapticFeedbackType.LongPress)
            },
            onDragStopped = {
                onDraggingChange?.invoke(false)
                onDrop?.invoke()
            },
        ),
        size = size,
        onMoveUp = if (index > 0) ({ onStep(-1) }) else null,
        onMoveDown = if (index < lastIndex) ({ onStep(1) }) else null,
    )
}

/**
 * Long-press-to-drag for the card region around the handle (the header row),
 * so grabbing a row does not demand hitting the 38.dp grip. Same haptics and
 * drop wiring as [EntryDragHandle]; keep it on a node that stays mounted for
 * the whole drag (see [ReorderableEntryHeader]).
 */
@Composable
fun ReorderableCollectionItemScope.longPressDrag(
    onDraggingChange: ((Boolean) -> Unit)? = null,
    onDrop: (() -> Unit)? = null,
): Modifier {
    val haptics = LocalHapticFeedback.current
    return Modifier.longPressDraggableHandle(
        onDragStarted = {
            onDraggingChange?.invoke(true)
            haptics.performHapticFeedback(HapticFeedbackType.LongPress)
        },
        onDragStopped = {
            onDraggingChange?.invoke(false)
            onDrop?.invoke()
        },
    )
}

/**
 * Entry-card header that stays structurally identical between the full and
 * collapsed (drag-live) states: the card body may unmount while dragging,
 * but this row — and with it the handle's node — must survive, or the very
 * gesture that collapsed everything would cancel itself.
 */
@Composable
fun ReorderableEntryHeader(
    kicker: String?,
    accentKicker: Boolean,
    compactNames: List<String>?,
    handle: (@Composable () -> Unit)?,
    modifier: Modifier = Modifier,
) {
    Row(
        modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            if (kicker != null) Kicker(kicker, accent = accentKicker)
            compactNames?.forEach {
                Text(it, style = LiftType.rowTitle, maxLines = 1)
            }
        }
        handle?.invoke()
    }
}
