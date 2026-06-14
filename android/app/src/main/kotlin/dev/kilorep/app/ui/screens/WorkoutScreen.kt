package dev.kilorep.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.kilorep.api.models.ToSessionInput
import dev.kilorep.app.data.SyncStatus
import dev.kilorep.app.store.DraftExercise
import dev.kilorep.app.ui.components.ConfirmDialog
import dev.kilorep.app.ui.components.DoneTick
import dev.kilorep.app.ui.components.ExercisePicker
import dev.kilorep.app.ui.components.GhostButton
import dev.kilorep.app.ui.components.Kicker
import dev.kilorep.app.ui.components.LiftCard
import dev.kilorep.app.ui.components.LiftIconButton
import dev.kilorep.app.ui.components.LiftScreen
import dev.kilorep.app.ui.components.LiftTextField
import dev.kilorep.app.ui.components.PrimaryButton
import dev.kilorep.app.ui.components.StepperField
import dev.kilorep.app.ui.components.Tag
import dev.kilorep.app.ui.formatWeight
import dev.kilorep.app.ui.parseWeight
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text

/**
 * The gym loop (CONTEXT.md): everything here must work offline and one-
 * handed. Each set is a tall row — weight and reps as thumb steppers, the
 * done-tick under the right thumb. Structure edits (swap, add, remove) ride
 * along without leaving the screen.
 */
@Composable
fun WorkoutScreen(
    viewModel: WorkoutViewModel,
    exercises: List<dev.kilorep.api.models.Exercise>,
    offline: Boolean,
    onBack: () -> Unit,
) {
    val draft by viewModel.draft.collectAsStateWithLifecycle()
    val syncStatus by viewModel.syncStatus.collectAsStateWithLifecycle()
    val template by viewModel.template.collectAsStateWithLifecycle()
    val syncBackResult by viewModel.syncBackResult.collectAsStateWithLifecycle()
    val colors = Lift.colors

    var picker by remember { mutableStateOf<PickerTarget?>(null) }
    var confirmRemove by remember { mutableStateOf<Triple<Int, Int, Int?>?>(null) }
    var confirmDiscard by remember { mutableStateOf(false) }
    var namingTemplate by remember { mutableStateOf(false) }

    val current = draft ?: run {
        LaunchedEffect(Unit) { onBack() }
        return
    }

    LaunchedEffect(current.dirty, current.serverId) {
        if (!current.dirty && current.serverId != null) viewModel.refreshTemplate()
    }

    LiftScreen(
        title = current.name,
        onBack = onBack,
        offline = offline,
        actions = {
            if (current.serverId == null && !current.completed) {
                LiftIconButton(
                    LiftIcons.Trash,
                    onClick = { confirmDiscard = true },
                    danger = true,
                )
            }
        },
    ) {
        Column(Modifier.fillMaxSize()) {
            LazyColumn(
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 14.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item { SyncStateRow(current.dirty, current.completed, syncStatus, viewModel) }

                itemsIndexed(current.entries, key = { _, entry -> entry.id }) { entryIndex, entry ->
                    LiftCard(padding = 12.dp) {
                        if (entry.exercises.size > 1) {
                            Kicker(
                                "Superset · ${entry.exercises.size} rotated",
                                accent = true,
                                modifier = Modifier.padding(bottom = 8.dp),
                            )
                        }
                        entry.exercises.forEachIndexed { exerciseIndex, exercise ->
                            ExerciseBlock(
                                entryIndex = entryIndex,
                                exerciseIndex = exerciseIndex,
                                exercise = exercise,
                                rotationTag = if (entry.exercises.size > 1) {
                                    ('A' + exerciseIndex).toString()
                                } else {
                                    null
                                },
                                viewModel = viewModel,
                                onSwap = { picker = PickerTarget.Swap(entryIndex, exerciseIndex) },
                                onRemove = {
                                    confirmRemove = Triple(entryIndex, exerciseIndex, null)
                                },
                                onRemoveSet = { setIndex ->
                                    confirmRemove = Triple(entryIndex, exerciseIndex, setIndex)
                                },
                            )
                        }
                    }
                }

                item {
                    GhostButton(
                        "Add exercise",
                        onClick = { picker = PickerTarget.Add },
                        icon = LiftIcons.Plus,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                if (template?.diverged == true && !current.dirty) {
                    item {
                        SyncBackStrip(
                            templateName = template?.name ?: "",
                            onUpdate = { viewModel.syncBack(ToSessionInput.Mode.update, null) },
                            onCreate = { namingTemplate = true },
                        )
                    }
                }
                if (syncBackResult != null) {
                    item {
                        Text(
                            syncBackResult ?: "",
                            style = LiftType.secondary,
                            color = colors.ink2,
                        )
                    }
                }
            }

            // The finish bar lives under the thumb, like the web's .wk-actions.
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(colors.bg)
                    .padding(horizontal = 14.dp, vertical = 10.dp)
                    .navigationBarsPadding()
                    .imePadding(),
            ) {
                if (!current.completed) {
                    PrimaryButton(
                        "Finish workout",
                        onClick = { viewModel.finish() },
                        modifier = Modifier.fillMaxWidth(),
                        height = 52.dp,
                        icon = LiftIcons.Check,
                        enabled = current.isSyncable,
                    )
                } else {
                    GhostButton(
                        "Reopen workout",
                        onClick = { viewModel.reopen() },
                        modifier = Modifier.fillMaxWidth(),
                    )
                }
            }
        }
    }

    when (val target = picker) {
        is PickerTarget.Swap -> ExercisePicker(
            exercises = exercises,
            title = "Swap exercise",
            onPick = {
                viewModel.swapExercise(target.entry, target.exercise, it.id, it.name)
                picker = null
            },
            onDismiss = { picker = null },
        )
        PickerTarget.Add -> ExercisePicker(
            exercises = exercises,
            title = "Add exercise",
            onPick = {
                viewModel.addExercise(it.id, it.name)
                picker = null
            },
            onDismiss = { picker = null },
        )
        null -> Unit
    }

    confirmRemove?.let { (entry, exercise, setIndex) ->
        ConfirmDialog(
            title = if (setIndex == null) "Remove exercise?" else "Remove set ${setIndex + 1}?",
            body = if (setIndex == null) {
                "Its logged sets go with it."
            } else {
                null
            },
            confirmLabel = "Remove",
            danger = true,
            onConfirm = {
                if (setIndex == null) {
                    viewModel.removeExercise(entry, exercise)
                } else {
                    viewModel.removeSet(entry, exercise, setIndex)
                }
                confirmRemove = null
            },
            onDismiss = { confirmRemove = null },
        )
    }

    if (confirmDiscard) {
        ConfirmDialog(
            title = "Discard this workout?",
            body = "It was never synced — this deletes it for good.",
            confirmLabel = "Discard",
            danger = true,
            onConfirm = {
                viewModel.discard()
                confirmDiscard = false
                onBack()
            },
            onDismiss = { confirmDiscard = false },
        )
    }

    if (namingTemplate) {
        NewTemplateDialog(
            onCreate = {
                viewModel.syncBack(ToSessionInput.Mode.create, it)
                namingTemplate = false
            },
            onDismiss = { namingTemplate = false },
        )
    }
}

private sealed interface PickerTarget {
    data class Swap(val entry: Int, val exercise: Int) : PickerTarget
    data object Add : PickerTarget
}

@Composable
private fun SyncStateRow(
    dirty: Boolean,
    completed: Boolean,
    status: SyncStatus?,
    viewModel: WorkoutViewModel,
) {
    val colors = Lift.colors
    Row(
        Modifier.fillMaxWidth().padding(top = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (completed) Tag("Completed", accent = true)
        when (val s = status) {
            SyncStatus.Syncing -> Tag("Syncing…")
            is SyncStatus.Error -> {
                Tag("Sync failed")
                Text(s.reason, style = LiftType.secondary, color = colors.danger, maxLines = 1)
                GhostButton("Retry", onClick = viewModel::retrySync, height = 32.dp)
            }
            else -> if (dirty) Tag("Not synced") else Tag("Synced")
        }
    }
}

@Composable
private fun ExerciseBlock(
    entryIndex: Int,
    exerciseIndex: Int,
    exercise: DraftExercise,
    rotationTag: String?,
    viewModel: WorkoutViewModel,
    onSwap: () -> Unit,
    onRemove: () -> Unit,
    onRemoveSet: (Int) -> Unit,
) {
    val colors = Lift.colors
    Column(Modifier.padding(top = if (exerciseIndex == 0) 0.dp else 14.dp)) {
        Row(
            Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            if (rotationTag != null) Tag(rotationTag, accent = true)
            Text(
                exercise.name,
                style = LiftType.rowTitle,
                modifier = Modifier.weight(1f),
                maxLines = 2,
            )
            LiftIconButton(LiftIcons.Swap, onClick = onSwap, size = 38.dp, iconSize = 17.dp)
            LiftIconButton(
                LiftIcons.Trash,
                onClick = onRemove,
                size = 38.dp,
                iconSize = 17.dp,
                danger = true,
            )
        }

        exercise.sets.forEachIndexed { setIndex, set ->
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp)
                    .border(1.dp, if (set.done) colors.accent.copy(alpha = 0.4f) else colors.line)
                    .background(if (set.done) colors.accentTint else colors.surface)
                    .padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        buildString {
                            append("SET ${setIndex + 1}")
                            set.target?.let { append("  ·  TARGET $it") }
                        },
                        style = LiftType.tag,
                        color = colors.ink3,
                    )
                    Text(
                        "REMOVE",
                        style = LiftType.tag,
                        color = colors.ink3,
                        modifier = Modifier
                            .clickable { onRemoveSet(setIndex) }
                            .padding(4.dp),
                    )
                }
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    StepperField(
                        value = set.weight?.let(::formatWeight) ?: "",
                        onValueChange = {
                            viewModel.setWeight(entryIndex, exerciseIndex, setIndex, parseWeight(it))
                        },
                        onStep = { viewModel.stepWeight(entryIndex, exerciseIndex, setIndex, it) },
                        suffix = "KG",
                        decimal = true,
                        modifier = Modifier.weight(1.15f),
                    )
                    StepperField(
                        value = set.reps?.toString() ?: "",
                        onValueChange = {
                            viewModel.setReps(entryIndex, exerciseIndex, setIndex, it.toIntOrNull())
                        },
                        onStep = { viewModel.stepReps(entryIndex, exerciseIndex, setIndex, it) },
                        suffix = "REPS",
                        modifier = Modifier.weight(1f),
                    )
                    DoneTick(
                        done = set.done,
                        onToggle = { viewModel.toggleDone(entryIndex, exerciseIndex, setIndex) },
                    )
                }
            }
        }

        GhostButton(
            "Add set",
            onClick = { viewModel.addSet(entryIndex, exerciseIndex) },
            icon = LiftIcons.Plus,
            modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
            height = 40.dp,
        )
    }
}

@Composable
private fun SyncBackStrip(
    templateName: String,
    onUpdate: () -> Unit,
    onCreate: () -> Unit,
) {
    LiftCard {
        Kicker("Diverged from template")
        Text(
            "This workout no longer matches “$templateName”.",
            style = LiftType.secondary,
            color = Lift.colors.ink2,
            modifier = Modifier.padding(top = 6.dp, bottom = 10.dp),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GhostButton("Update template", onUpdate, Modifier.weight(1f), height = 40.dp)
            GhostButton("New template", onCreate, Modifier.weight(1f), height = 40.dp)
        }
    }
}

@Composable
private fun NewTemplateDialog(onCreate: (String) -> Unit, onDismiss: () -> Unit) {
    var name by remember { mutableStateOf("") }
    androidx.compose.ui.window.Dialog(onDismissRequest = onDismiss) {
        val colors = Lift.colors
        Column(
            Modifier
                .fillMaxWidth()
                .background(colors.surface)
                .border(1.dp, colors.line2)
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("New session template", style = LiftType.rowTitle)
            LiftTextField(
                value = name,
                onValueChange = { name = it },
                placeholder = "Template name",
                modifier = Modifier.fillMaxWidth(),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                GhostButton("Cancel", onDismiss, Modifier.weight(1f))
                PrimaryButton(
                    "Create",
                    onClick = { onCreate(name) },
                    modifier = Modifier.weight(1f),
                    enabled = name.isNotBlank(),
                )
            }
        }
    }
}
