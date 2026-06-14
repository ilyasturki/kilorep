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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.kilorep.api.models.WorkoutWithEntries
import dev.kilorep.app.data.Repo
import dev.kilorep.app.ui.components.ConfirmDialog
import dev.kilorep.app.ui.components.EmptyState
import dev.kilorep.app.ui.components.Kicker
import dev.kilorep.app.ui.components.LiftCard
import dev.kilorep.app.ui.components.LiftIconButton
import dev.kilorep.app.ui.components.LiftScreen
import dev.kilorep.app.ui.components.Tag
import dev.kilorep.app.ui.formatDay
import dev.kilorep.app.ui.formatReps
import dev.kilorep.app.ui.formatWeight
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text
import dev.kilorep.app.ui.watch
import kotlinx.coroutines.launch

/**
 * Workout history — the "what did I lift last time" reference. Serves the
 * cache instantly, refreshes when online; tapping a workout reopens it in
 * the logging screen.
 */
@Composable
fun HistoryScreen(
    repo: Repo,
    offline: Boolean,
    onOpenServerWorkout: (Int) -> Unit,
) {
    val workouts = repo.workouts.watch()
    val scope = rememberCoroutineScope()
    var confirmDelete by remember { mutableStateOf<WorkoutWithEntries?>(null) }

    // Keyed on offline so coming online mid-screen still refreshes.
    LaunchedEffect(offline) {
        if (!offline) repo.refreshWorkouts()
    }

    LiftScreen(title = "History", offline = offline) {
        if (workouts.isEmpty()) {
            EmptyState(
                title = "No workouts yet",
                hint = "Finish your first workout and it lands here.",
                modifier = Modifier.padding(14.dp),
            )
            return@LiftScreen
        }
        LazyColumn(
            Modifier
                .fillMaxSize()
                .padding(horizontal = 14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(workouts, key = { it.id }) { workout ->
                WorkoutHistoryCard(
                    workout = workout,
                    onOpen = { onOpenServerWorkout(workout.id) },
                    onDelete = { confirmDelete = workout },
                )
            }
        }
    }

    confirmDelete?.let { workout ->
        ConfirmDialog(
            title = "Delete “${workout.name}”?",
            body = "Its logged sets are gone for good.",
            confirmLabel = "Delete",
            danger = true,
            onConfirm = {
                scope.launch { repo.deleteWorkout(workout.id) }
                confirmDelete = null
            },
            onDismiss = { confirmDelete = null },
        )
    }
}

@Composable
private fun WorkoutHistoryCard(
    workout: WorkoutWithEntries,
    onOpen: () -> Unit,
    onDelete: () -> Unit,
) {
    val colors = Lift.colors
    LiftCard(padding = 14.dp) {
        Column(Modifier.clickable(onClick = onOpen)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(workout.name, style = LiftType.rowTitle)
                    Text(
                        formatDay(workout.startedAt),
                        style = LiftType.mono,
                        color = colors.ink2,
                        modifier = Modifier.padding(top = 2.dp),
                    )
                }
                if (!workout.completed) {
                    Tag("Open")
                }
                LiftIconButton(
                    LiftIcons.Trash,
                    onClick = onDelete,
                    size = 36.dp,
                    iconSize = 16.dp,
                    danger = true,
                )
            }
            // The "load the bar" summary: each exercise's heaviest set.
            workout.entries.flatMap { it.exercises }.forEach { exercise ->
                val best = exercise.sets
                    .filter { it.weight != null }
                    .maxByOrNull { it.weight ?: 0.0 }
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        exercise.exercise.name,
                        style = LiftType.secondary,
                        color = colors.ink2,
                        modifier = Modifier.weight(1f),
                        maxLines = 1,
                    )
                    Text(
                        if (best != null) {
                            "${formatWeight(best.weight)} kg × ${formatReps(best.reps)}"
                        } else {
                            "${exercise.sets.size} sets"
                        },
                        style = LiftType.mono,
                        color = colors.ink,
                    )
                }
            }
        }
    }
}
