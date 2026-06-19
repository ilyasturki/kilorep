package dev.kilorep.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
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
import dev.kilorep.app.ui.components.EmptyState
import dev.kilorep.app.ui.components.FullScreenDialog
import dev.kilorep.app.ui.components.LiftCard
import dev.kilorep.app.ui.components.PrimaryButton
import dev.kilorep.app.ui.plural
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text
import dev.kilorep.app.ui.watch
import kotlinx.coroutines.launch

/**
 * The Start/Continue CTA, shared by the Dashboard and the Workouts list
 * (mirrors web's WorkoutStartButton). It flips to "Continue" whenever a
 * workout is already in progress — a local draft, or one started on another
 * device — and otherwise opens the session picker. Single-active is the
 * invariant it leans on; Repo.startWorkout is the backstop.
 */
@Composable
fun WorkoutStartButton(
    repo: Repo,
    onOpen: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val drafts = repo.drafts.watch()
    val workouts = repo.workouts.watch()
    val sessions = repo.sessions.watch()
    val scope = rememberCoroutineScope()
    var pickerOpen by remember { mutableStateOf(false) }

    val activeDraft = drafts.firstOrNull { !it.completed }
    val draftServerIds = drafts.mapNotNull { it.serverId }.toSet()
    // A workout opened on another device shows as in-progress here too, even
    // before it has a local draft.
    val activeServer = if (activeDraft == null) {
        workouts.firstOrNull { !it.completed && it.id !in draftServerIds }
    } else {
        null
    }

    if (activeDraft != null || activeServer != null) {
        PrimaryButton(
            "Continue workout",
            onClick = {
                when {
                    activeDraft != null -> onOpen(activeDraft.localId)
                    activeServer != null -> scope.launch {
                        repo.openWorkout(activeServer.id).onSuccess { onOpen(it.localId) }
                    }
                }
            },
            modifier = modifier,
            icon = LiftIcons.Play,
        )
    } else {
        PrimaryButton(
            "Start workout",
            onClick = { pickerOpen = true },
            modifier = modifier,
            icon = LiftIcons.Plus,
        )
    }

    if (pickerOpen) {
        SessionPickerDialog(
            sessions = sessions,
            onPick = { session ->
                pickerOpen = false
                onOpen(repo.startWorkout(session).localId)
            },
            onDismiss = { pickerOpen = false },
        )
    }
}

@Composable
private fun SessionPickerDialog(
    sessions: List<SessionWithEntries>,
    onPick: (SessionWithEntries) -> Unit,
    onDismiss: () -> Unit,
) {
    FullScreenDialog(title = "Start workout", onDismiss = onDismiss) {
        if (sessions.isEmpty()) {
            EmptyState(
                title = "No sessions yet",
                hint = "Build one in the Sessions tab to start tracking.",
                modifier = Modifier.padding(14.dp),
            )
            return@FullScreenDialog
        }
        LazyColumn(
            Modifier.fillMaxSize().padding(horizontal = 14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(sessions, key = { it.id }) { session ->
                val exercises = session.entries.sumOf { it.exercises.size }
                LiftCard(padding = 14.dp) {
                    Row(
                        Modifier.fillMaxWidth().clickable { onPick(session) },
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            session.name,
                            style = LiftType.rowTitle,
                            modifier = Modifier.weight(1f),
                            maxLines = 1,
                        )
                        Text(
                            plural(exercises, "exercise"),
                            style = LiftType.tag,
                            color = Lift.colors.ink3,
                        )
                    }
                }
            }
        }
    }
}
