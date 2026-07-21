package dev.kilorep.app.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import dev.kilorep.api.models.ExerciseDetail
import dev.kilorep.app.data.Repo
import dev.kilorep.app.data.statusCodeOrNull
import dev.kilorep.app.data.userMessage
import dev.kilorep.app.ui.components.ConfirmDialog
import dev.kilorep.app.ui.components.ExercisePicker
import dev.kilorep.app.ui.components.GhostButton
import dev.kilorep.app.ui.components.IntensityBadge
import dev.kilorep.app.ui.components.Kicker
import dev.kilorep.app.ui.components.LiftCard
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
 * One movement: muscles by intensity, where it's programmed, the personal
 * best, full history — plus edit, merge and delete (delete hands over to
 * merge when the exercise is still referenced).
 */
@Composable
fun ExerciseDetailScreen(
    repo: Repo,
    exerciseId: Int,
    offline: Boolean,
    onEdit: () -> Unit,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val catalog = repo.exercises.watch()
    var detail by remember { mutableStateOf<ExerciseDetail?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var merging by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var deleteBlocked by remember { mutableStateOf<String?>(null) }
    val colors = Lift.colors
    val uriHandler = LocalUriHandler.current

    LaunchedEffect(exerciseId, catalog) {
        repo.exerciseDetail(exerciseId)
            .onSuccess { detail = it; error = null }
            .onFailure { error = it.userMessage() }
    }

    val current = detail
    LiftScreen(
        title = current?.name ?: "Exercise",
        onBack = onBack,
        offline = offline,
    ) {
        if (current == null) {
            Text(
                error ?: "Loading…",
                style = LiftType.secondary,
                color = if (error == null) colors.ink3 else colors.danger,
                modifier = Modifier.padding(16.dp),
            )
            return@LiftScreen
        }
        LazyColumn(
            Modifier.fillMaxSize().padding(horizontal = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Tag(current.equipment.value)
                    Tag(current.type.value)
                }
            }
            item {
                LiftCard(padding = 14.dp) {
                    Kicker("Muscles")
                    Row(
                        Modifier.padding(top = 8.dp),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        current.muscles.forEach {
                            IntensityBadge(it.muscle, it.intensity.value)
                        }
                    }
                }
            }
            item {
                LiftCard(padding = 14.dp) {
                    Kicker("How to")
                    GhostButton(
                        "Watch form tutorials on YouTube",
                        onClick = {
                            val q = java.net.URLEncoder.encode(
                                "${current.name} proper form technique",
                                "UTF-8",
                            )
                            uriHandler.openUri("https://www.youtube.com/results?search_query=$q")
                        },
                        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    )
                }
            }
            if (current.best != null) {
                item {
                    LiftCard(padding = 14.dp) {
                        Kicker("Personal best", accent = true)
                        Row(
                            Modifier.fillMaxWidth().padding(top = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "${formatWeight(current.best?.weight)} kg × ${formatReps(current.best?.reps)}",
                                style = LiftType.statNum,
                            )
                            Text(
                                current.best?.startedAt?.let { formatDay(it) } ?: "",
                                style = LiftType.mono,
                                color = colors.ink2,
                            )
                        }
                    }
                }
            }
            if (current.sessions.isNotEmpty()) {
                item {
                    LiftCard(padding = 14.dp) {
                        Kicker("Programmed in")
                        Row(
                            Modifier.padding(top = 8.dp),
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            current.sessions.forEach { Tag(it.name) }
                        }
                    }
                }
            }
            item { Kicker("History") }
            if (current.history.isEmpty()) {
                item {
                    Text(
                        "Never performed yet.",
                        style = LiftType.secondary,
                        color = colors.ink3,
                    )
                }
            }
            items(current.history.size) { index ->
                val workout = current.history[index]
                LiftCard(padding = 12.dp) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(workout.name, style = LiftType.secondary, color = colors.ink2)
                        Text(
                            formatDay(workout.startedAt),
                            style = LiftType.mono,
                            color = colors.ink2,
                        )
                    }
                    Text(
                        buildAnnotatedString {
                            val ordinal = SpanStyle(color = colors.ink3)
                            workout.sets.forEachIndexed { position, set ->
                                if (position > 0) append("   ")
                                withStyle(ordinal) { append("${position + 1} · ") }
                                append(
                                    "${formatWeight(set.weight)}×${formatReps(set.reps)}",
                                )
                            }
                        },
                        style = LiftType.mono,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                }
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        GhostButton(
                            "Edit",
                            onClick = onEdit,
                            icon = LiftIcons.Pencil,
                            modifier = Modifier.weight(1f),
                        )
                        GhostButton(
                            "Merge into…",
                            onClick = { merging = true },
                            icon = LiftIcons.Merge,
                            modifier = Modifier.weight(1f),
                        )
                    }
                    GhostButton(
                        "Delete",
                        onClick = { confirmDelete = true },
                        icon = LiftIcons.Trash,
                        danger = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (deleteBlocked != null) {
                        Text(
                            deleteBlocked ?: "",
                            style = LiftType.secondary,
                            color = colors.danger,
                        )
                    }
                }
            }
        }
    }

    if (merging) {
        ExercisePicker(
            exercises = catalog,
            title = "Merge into",
            excludeIds = setOf(exerciseId),
            onPick = { target ->
                scope.launch {
                    repo.mergeExercise(exerciseId, target.id)
                        .onSuccess { onBack() }
                        .onFailure { deleteBlocked = it.userMessage() }
                }
                merging = false
            },
            onDismiss = { merging = false },
        )
    }

    if (confirmDelete) {
        ConfirmDialog(
            title = "Delete “${current?.name}”?",
            body = "Only possible while nothing references it — merge otherwise.",
            confirmLabel = "Delete",
            danger = true,
            onConfirm = {
                scope.launch {
                    repo.deleteExercise(exerciseId)
                        .onSuccess { onBack() }
                        .onFailure {
                            deleteBlocked =
                                if (it.statusCodeOrNull() == 409) {
                                    "${it.userMessage()} Use merge instead."
                                } else {
                                    it.userMessage()
                                }
                        }
                }
                confirmDelete = false
            },
            onDismiss = { confirmDelete = false },
        )
    }
}
