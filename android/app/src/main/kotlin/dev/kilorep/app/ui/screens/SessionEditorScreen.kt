package dev.kilorep.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.kilorep.api.models.Exercise
import dev.kilorep.app.ui.components.DragHandle
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
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text
import sh.calvin.reorderable.ReorderableColumn
import sh.calvin.reorderable.ReorderableItem
import sh.calvin.reorderable.rememberReorderableLazyListState

/**
 * Build or rework a session template: ordered entries, supersets (several
 * exercises in one entry, rotated), prescribed sets with open targets.
 */
@Composable
fun SessionEditorScreen(
    viewModel: SessionEditorViewModel,
    exercises: List<Exercise>,
    onBack: () -> Unit,
    onOpenExercise: (Int) -> Unit,
) {
    val name by viewModel.name.collectAsStateWithLifecycle()
    val entries by viewModel.entries.collectAsStateWithLifecycle()
    val busy by viewModel.busy.collectAsStateWithLifecycle()
    val error by viewModel.error.collectAsStateWithLifecycle()
    val saved by viewModel.saved.collectAsStateWithLifecycle()
    val colors = Lift.colors

    // null = closed, -1 = new entry, otherwise add-into-entry (superset)
    var pickerFor by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(saved) {
        if (saved) onBack()
    }

    val listState = rememberLazyListState()
    val haptics = LocalHapticFeedback.current
    // While an entry drag is live every entry collapses to a compact row —
    // more drop targets on screen than the full cards would allow.
    var reordering by remember { mutableStateOf(false) }
    val reorderState = rememberReorderableLazyListState(listState) { from, to ->
        viewModel.moveEntry(from.key as String, to.key as String)
        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
    }

    LiftScreen(title = if (name.isEmpty()) "New session" else name, onBack = onBack) {
        Column(Modifier.fillMaxSize()) {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 14.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                item {
                    LiftTextField(
                        value = name,
                        onValueChange = viewModel::setName,
                        placeholder = "Session name (e.g. Push Day)",
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                itemsIndexed(entries, key = { _, entry -> entry.id }) { entryIndex, entry ->
                    ReorderableItem(reorderState, key = entry.id) { isDragging ->
                        val superset = entry.exercises.size > 1
                        val handle: (@Composable () -> Unit)? =
                            if (entries.size > 1) {
                                {
                                    DragHandle(
                                        modifier = Modifier.draggableHandle(
                                            onDragStarted = {
                                                reordering = true
                                                haptics.performHapticFeedback(
                                                    HapticFeedbackType.LongPress,
                                                )
                                            },
                                            onDragStopped = { reordering = false },
                                        ),
                                        size = 36.dp,
                                        onMoveUp = { viewModel.moveEntry(entryIndex, -1) }
                                            .takeIf { entryIndex > 0 },
                                        onMoveDown = { viewModel.moveEntry(entryIndex, 1) }
                                            .takeIf { entryIndex < entries.lastIndex },
                                    )
                                }
                            } else {
                                null
                            }
                        if (reordering && handle != null) {
                            CompactEntryRow(entry = entry, dragging = isDragging, handle = handle)
                        } else {
                            LiftCard(padding = 12.dp) {
                                Row(
                                    Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Kicker(
                                        if (superset) "Superset" else "Exercise",
                                        accent = superset,
                                        modifier = Modifier.weight(1f),
                                    )
                                    handle?.invoke()
                                }

                                if (superset) {
                                    ReorderableColumn(
                                        list = entry.exercises,
                                        onSettle = { from, to ->
                                            viewModel.moveExerciseTo(entryIndex, from, to)
                                        },
                                    ) { exerciseIndex, exercise, _ ->
                                        key(exercise.exerciseId) {
                                            ReorderableItem {
                                                EditorExerciseBlock(
                                                    entryIndex = entryIndex,
                                                    exerciseIndex = exerciseIndex,
                                                    exercise = exercise,
                                                    inSuperset = true,
                                                    viewModel = viewModel,
                                                    onOpen = { onOpenExercise(exercise.exerciseId) },
                                                    handle = {
                                                        DragHandle(
                                                            modifier = Modifier.draggableHandle(
                                                                onDragStarted = {
                                                                    haptics.performHapticFeedback(
                                                                        HapticFeedbackType.LongPress,
                                                                    )
                                                                },
                                                            ),
                                                            size = 32.dp,
                                                            onMoveUp = {
                                                                viewModel.moveExercise(entryIndex, exerciseIndex, -1)
                                                            }.takeIf { exerciseIndex > 0 },
                                                            onMoveDown = {
                                                                viewModel.moveExercise(entryIndex, exerciseIndex, 1)
                                                            }.takeIf { exerciseIndex < entry.exercises.lastIndex },
                                                        )
                                                    },
                                                )
                                            }
                                        }
                                    }
                                } else {
                                    entry.exercises.forEachIndexed { exerciseIndex, exercise ->
                                        EditorExerciseBlock(
                                            entryIndex = entryIndex,
                                            exerciseIndex = exerciseIndex,
                                            exercise = exercise,
                                            inSuperset = false,
                                            viewModel = viewModel,
                                            onOpen = { onOpenExercise(exercise.exerciseId) },
                                            handle = null,
                                        )
                                    }
                                }

                                GhostButton(
                                    if (superset) "Add to superset" else "Make superset",
                                    onClick = { pickerFor = entryIndex },
                                    icon = LiftIcons.Plus,
                                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                                    height = 38.dp,
                                )
                            }
                        }
                    }
                }

                item {
                    GhostButton(
                        "Add exercise",
                        onClick = { pickerFor = -1 },
                        icon = LiftIcons.Plus,
                        modifier = Modifier.fillMaxWidth(),
                    )
                }

                if (error != null) {
                    item {
                        Text(error ?: "", style = LiftType.secondary, color = colors.danger)
                    }
                }
            }

            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 10.dp)
                    .navigationBarsPadding()
                    .imePadding(),
            ) {
                PrimaryButton(
                    "Save session",
                    onClick = viewModel::save,
                    modifier = Modifier.fillMaxWidth(),
                    height = 52.dp,
                    enabled = viewModel.canSave && !busy,
                )
            }
        }
    }

    pickerFor?.let { target ->
        ExercisePicker(
            exercises = exercises,
            title = if (target == -1) "Add exercise" else "Add to superset",
            onPick = {
                if (target == -1) {
                    viewModel.addEntry(it.id, it.name)
                } else {
                    viewModel.addToEntry(target, it.id, it.name)
                }
                pickerFor = null
            },
            onDismiss = { pickerFor = null },
        )
    }
}

/** What an entry collapses to while a drag is live: names + grip only. */
@Composable
private fun CompactEntryRow(
    entry: EditEntry,
    dragging: Boolean,
    handle: @Composable () -> Unit,
) {
    val colors = Lift.colors
    Column(
        Modifier
            .fillMaxWidth()
            .background(colors.surface)
            .border(1.dp, if (dragging) colors.accent else colors.line2)
            .padding(12.dp),
    ) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                if (entry.exercises.size > 1) Kicker("Superset", accent = true)
                entry.exercises.forEach {
                    Text(it.name, style = LiftType.rowTitle, maxLines = 1)
                }
            }
            handle()
        }
    }
}

@Composable
private fun EditorExerciseBlock(
    entryIndex: Int,
    exerciseIndex: Int,
    exercise: EditExercise,
    inSuperset: Boolean,
    viewModel: SessionEditorViewModel,
    onOpen: () -> Unit,
    handle: (@Composable () -> Unit)?,
) {
    val colors = Lift.colors
    Column(Modifier.padding(top = 10.dp)) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (inSuperset) Tag(('A' + exerciseIndex).toString(), accent = true)
            Text(
                exercise.name,
                style = LiftType.rowTitle,
                modifier = Modifier
                    .weight(1f)
                    .clickable(onClick = onOpen),
            )
            handle?.invoke()
            LiftIconButton(
                LiftIcons.Trash,
                onClick = { viewModel.removeExercise(entryIndex, exerciseIndex) },
                size = 32.dp,
                iconSize = 14.dp,
                danger = true,
            )
        }

        exercise.sets.forEachIndexed { setIndex, reps ->
            Row(
                Modifier.fillMaxWidth().padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "SET ${setIndex + 1}",
                    style = LiftType.tag,
                    color = colors.ink3,
                    modifier = Modifier.weight(0.5f),
                )
                StepperField(
                    value = reps?.toString() ?: "",
                    onValueChange = {
                        viewModel.setReps(entryIndex, exerciseIndex, setIndex, it.toIntOrNull())
                    },
                    onStep = { delta ->
                        val next = ((reps ?: 0) + delta).coerceAtLeast(0)
                        viewModel.setReps(
                            entryIndex,
                            exerciseIndex,
                            setIndex,
                            next.takeIf { it > 0 },
                        )
                    },
                    suffix = "REPS",
                    modifier = Modifier.weight(1.6f),
                )
                Text(
                    "REMOVE",
                    style = LiftType.tag,
                    color = colors.ink3,
                    modifier = Modifier
                        .clickable {
                            viewModel.removeSet(entryIndex, exerciseIndex, setIndex)
                        }
                        .padding(4.dp),
                )
            }
        }
        Text(
            "An empty target stays open — reps get decided at the rack.",
            style = LiftType.secondary,
            color = colors.ink3,
            modifier = Modifier.padding(top = 6.dp),
        )
        GhostButton(
            "Add set",
            onClick = { viewModel.addSet(entryIndex, exerciseIndex) },
            icon = LiftIcons.Plus,
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            height = 36.dp,
        )
    }
}
