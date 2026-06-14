package dev.kilorep.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.kilorep.api.models.SessionWithEntries
import dev.kilorep.app.data.Repo
import dev.kilorep.app.data.SyncStatus
import dev.kilorep.app.store.WorkoutDraft
import dev.kilorep.app.ui.components.EmptyState
import dev.kilorep.app.ui.components.GhostButton
import dev.kilorep.app.ui.components.Kicker
import dev.kilorep.app.ui.components.LiftCard
import dev.kilorep.app.ui.components.LiftScreen
import dev.kilorep.app.ui.components.PrimaryButton
import dev.kilorep.app.ui.components.Tag
import dev.kilorep.app.ui.formatDay
import dev.kilorep.app.ui.watch
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text

/**
 * The first screen at the gym: resume what's in flight, or start from a
 * session in one tap. Sessions come from the on-device cache, so a dead
 * zone changes nothing.
 */
@Composable
fun TrainScreen(
    repo: Repo,
    offline: Boolean,
    onOpenWorkout: (String) -> Unit,
    onStart: (SessionWithEntries) -> Unit,
) {
    val sessions = repo.sessions.watch()
    val drafts = repo.drafts.watch()
    val syncStatus = repo.syncStatus.watch()

    // Keyed on offline so coming online mid-screen still refreshes.
    LaunchedEffect(offline) {
        if (!offline) repo.refreshAll()
    }

    LiftScreen(title = "Kilorep", offline = offline) {
        LazyColumn(
            Modifier
                .fillMaxSize()
                .padding(horizontal = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            val active = drafts.filter { !it.completed }
            // Clean completed drafts are just cached server workouts (opened
            // from History); only dirty ones are actually waiting to sync.
            val pending = drafts.filter { it.completed && it.dirty }

            if (active.isNotEmpty()) {
                item { Kicker("In progress") }
                items(active, key = { it.localId }) { draft ->
                    ActiveDraftCard(draft, onOpenWorkout)
                }
            }

            if (pending.isNotEmpty()) {
                item { Kicker("Waiting to sync") }
                items(pending, key = { it.localId }) { draft ->
                    PendingDraftRow(draft, syncStatus[draft.localId], onOpenWorkout)
                }
            }

            item { Kicker("Start a session") }
            if (sessions.isEmpty()) {
                item {
                    EmptyState(
                        title = "No sessions yet",
                        hint = "Build one in the Sessions tab, or connect to load yours.",
                    )
                }
            }
            items(sessions, key = { it.id }) { session ->
                SessionStartCard(session) { onStart(session) }
            }
        }
    }
}

@Composable
private fun ActiveDraftCard(draft: WorkoutDraft, onOpen: (String) -> Unit) {
    LiftCard {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(draft.name, style = LiftType.rowTitle)
                Text(
                    "Started ${formatDay(draft.startedAt)}",
                    style = LiftType.secondary,
                    color = Lift.colors.ink2,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
        }
        PrimaryButton(
            "Resume",
            onClick = { onOpen(draft.localId) },
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            icon = LiftIcons.ChevronRight,
        )
    }
}

@Composable
private fun PendingDraftRow(
    draft: WorkoutDraft,
    status: SyncStatus?,
    onOpen: (String) -> Unit,
) {
    val colors = Lift.colors
    LiftCard(padding = 12.dp) {
        Row(
            Modifier
                .fillMaxWidth()
                .clickable { onOpen(draft.localId) },
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(draft.name, style = LiftType.rowTitle)
                if (status is SyncStatus.Error) {
                    Text(
                        status.reason,
                        style = LiftType.secondary,
                        color = colors.danger,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
            }
            when (status) {
                SyncStatus.Syncing -> Tag("Syncing…")
                is SyncStatus.Error -> Tag("Sync failed")
                else -> Tag("Queued")
            }
        }
    }
}

@Composable
private fun SessionStartCard(session: SessionWithEntries, onStart: () -> Unit) {
    val colors = Lift.colors
    val exerciseCount = session.entries.sumOf { it.exercises.size }
    val setCount = session.entries.sumOf { entry ->
        entry.exercises.sumOf { it.sets.size }
    }
    LiftCard(padding = 14.dp) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(session.name, style = LiftType.rowTitle)
                Text(
                    "$exerciseCount exercises · $setCount sets",
                    style = LiftType.secondary,
                    color = colors.ink2,
                    modifier = Modifier.padding(top = 2.dp),
                )
            }
            GhostButton("Start", onClick = onStart, height = 44.dp)
        }
    }
}
