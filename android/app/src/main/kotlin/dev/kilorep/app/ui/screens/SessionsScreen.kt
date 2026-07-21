package dev.kilorep.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.kilorep.api.models.SessionWithEntries
import dev.kilorep.app.data.Repo
import dev.kilorep.app.ui.components.ConfirmDialog
import dev.kilorep.app.ui.components.EmptyState
import dev.kilorep.app.ui.components.EntryDragHandle
import dev.kilorep.app.ui.components.GhostButton
import dev.kilorep.app.ui.components.LiftCard
import dev.kilorep.app.ui.components.LiftIconButton
import dev.kilorep.app.ui.components.LiftScreen
import dev.kilorep.app.ui.components.PrimaryButton
import dev.kilorep.app.ui.components.longPressDrag
import dev.kilorep.app.ui.components.rememberLiftReorder
import dev.kilorep.app.ui.movedByKey
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text
import dev.kilorep.app.ui.watch
import kotlinx.coroutines.launch
import sh.calvin.reorderable.ReorderableItem

/**
 * Session templates: create, edit, reorder (most-used on top), delete.
 * Reordering is handle drag or a long-press on the title row; explicit
 * up/down survives as TalkBack actions.
 */
@Composable
fun SessionsScreen(
    repo: Repo,
    offline: Boolean,
    onEdit: (Int?) -> Unit,
) {
    val sessions = repo.sessions.watch()
    val scope = rememberCoroutineScope()
    var confirmDelete by remember { mutableStateOf<SessionWithEntries?>(null) }

    // Keyed on offline so coming online mid-screen still refreshes.
    LaunchedEffect(offline) {
        if (!offline) repo.refreshSessions()
    }

    // Drag moves this local order; the API call lands once, on drop. The
    // remember key resets it whenever the repo emits (refresh, other device).
    var order by remember(sessions) { mutableStateOf(sessions) }
    val listState = rememberLazyListState()
    val reorderState = rememberLiftReorder(listState) { from, to ->
        order = order.movedByKey(from, to) { it.id }
    }

    fun commitOrder() {
        val ids = order.map { it.id }
        if (ids != sessions.map { it.id }) scope.launch { repo.reorderSessions(ids) }
    }

    // TalkBack path: one explicit step is one immediate reorder call.
    fun moveByOne(index: Int, delta: Int) {
        val ids = order.map { it.id }.toMutableList()
        val to = index + delta
        if (to !in ids.indices) return
        ids[index] = ids.set(to, ids[index])
        scope.launch { repo.reorderSessions(ids) }
    }

    LiftScreen(
        title = "Sessions",
        offline = offline,
        actions = {
            LiftIconButton(LiftIcons.Plus, onClick = { onEdit(null) })
        },
    ) {
        if (sessions.isEmpty()) {
            EmptyState(
                title = "No sessions yet",
                hint = "A session is your reusable plan — exercises and rep targets.",
                modifier = Modifier.padding(14.dp),
            )
            return@LiftScreen
        }
        LazyColumn(
            state = listState,
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            itemsIndexed(order, key = { _, it -> it.id }) { index, session ->
                ReorderableItem(reorderState, key = session.id) { isDragging ->
                    SessionCard(
                        session = session,
                        dragging = isDragging,
                        handle = if (order.size > 1) {
                            {
                                EntryDragHandle(
                                    index = index,
                                    lastIndex = order.lastIndex,
                                    onStep = { moveByOne(index, it) },
                                    onDrop = ::commitOrder,
                                )
                            }
                        } else {
                            null
                        },
                        headerDrag = if (order.size > 1) {
                            longPressDrag(onDrop = ::commitOrder)
                        } else {
                            Modifier
                        },
                        onEdit = { onEdit(session.id) },
                        onDelete = { confirmDelete = session },
                    )
                }
            }
        }
    }

    confirmDelete?.let { session ->
        ConfirmDialog(
            title = "Delete “${session.name}”?",
            body = "Workouts you logged from it keep their history.",
            confirmLabel = "Delete",
            danger = true,
            onConfirm = {
                scope.launch { repo.deleteSession(session.id) }
                confirmDelete = null
            },
            onDismiss = { confirmDelete = null },
        )
    }
}

@Composable
private fun SessionCard(
    session: SessionWithEntries,
    dragging: Boolean,
    handle: (@Composable () -> Unit)?,
    headerDrag: Modifier,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
) {
    val colors = Lift.colors
    val supersets = session.entries.count { it.exercises.size > 1 }
    LiftCard(
        padding = 14.dp,
        borderColor = if (dragging) colors.accent else null,
    ) {
        Row(
            headerDrag.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(session.name, style = LiftType.rowTitle)
                Text(
                    buildString {
                        append("${session.entries.sumOf { it.exercises.size }} exercises")
                        if (supersets > 0) append(" · $supersets superset${if (supersets == 1) "" else "s"}")
                    },
                    style = LiftType.secondary,
                    color = colors.ink2,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            handle?.invoke()
        }
        Row(
            Modifier.fillMaxWidth().padding(top = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            GhostButton(
                "Edit",
                onClick = onEdit,
                icon = LiftIcons.Pencil,
                modifier = Modifier.weight(1f),
                height = 40.dp,
            )
            GhostButton(
                "Delete",
                onClick = onDelete,
                icon = LiftIcons.Trash,
                danger = true,
                modifier = Modifier.weight(1f),
                height = 40.dp,
            )
        }
    }
}
