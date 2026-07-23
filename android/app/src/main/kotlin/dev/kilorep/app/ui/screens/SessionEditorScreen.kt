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
import dev.kilorep.app.ui.components.EntryDragHandle
import dev.kilorep.app.ui.components.ExercisePicker
import dev.kilorep.app.ui.components.GhostButton
import dev.kilorep.app.ui.components.LiftCard
import dev.kilorep.app.ui.components.LiftIconButton
import dev.kilorep.app.ui.components.LiftMenu
import dev.kilorep.app.ui.components.LiftMenuItem
import dev.kilorep.app.ui.components.LiftScreen
import dev.kilorep.app.ui.components.LiftTextField
import dev.kilorep.app.ui.components.PrimaryButton
import dev.kilorep.app.ui.components.ReorderableEntryHeader
import dev.kilorep.app.ui.components.StepperField
import dev.kilorep.app.ui.components.Tag
import dev.kilorep.app.ui.components.rememberLiftReorder
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text
import sh.calvin.reorderable.ReorderableColumn
import sh.calvin.reorderable.ReorderableItem

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

    var picker by remember { mutableStateOf<EditorPicker?>(null) }

    LaunchedEffect(saved) {
        if (saved) onBack()
    }

    val listState = rememberLazyListState()
    val haptics = LocalHapticFeedback.current
    // While an entry drag is live every entry collapses to a compact row —
    // more drop targets on screen than the full cards would allow.
    var reordering by remember { mutableStateOf(false) }
    val reorderState = rememberLiftReorder(listState) { from, to ->
        viewModel.moveEntry(from as String, to as String)
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
                                    EntryDragHandle(
                                        index = entryIndex,
                                        lastIndex = entries.lastIndex,
                                        onStep = { viewModel.moveEntry(entryIndex, it) },
                                        size = 36.dp,
                                        onDraggingChange = { reordering = it },
                                    )
                                }
                            } else {
                                null
                            }
                        val compact = reordering && handle != null
                        LiftCard(
                            padding = 12.dp,
                            borderColor = if (isDragging) Lift.colors.accent else null,
                        ) {
                            ReorderableEntryHeader(
                                kicker = if (superset) "Superset" else "Exercise",
                                accentKicker = superset,
                                compactNames = if (compact) entry.exercises.map { it.name } else null,
                                handle = handle,
                                // Entry-level actions for a superset live on
                                // its header; member rows keep their inline ✕.
                                actions = if (superset && !compact) {
                                    {
                                        LiftMenu(
                                            items = listOf(
                                                LiftMenuItem(
                                                    "Insert exercise below",
                                                    LiftIcons.RowInsertBottom,
                                                ) { picker = EditorPicker.InsertBelow(entryIndex) },
                                                LiftMenuItem(
                                                    "Remove",
                                                    LiftIcons.Trash,
                                                    danger = true,
                                                ) { viewModel.removeEntry(entryIndex) },
                                            ),
                                            size = 36.dp,
                                            iconSize = 15.dp,
                                        )
                                    }
                                } else {
                                    null
                                },
                            )

                            if (!compact && superset) {
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
                                                        onMoveUp = if (exerciseIndex > 0) {
                                                            { viewModel.moveExercise(entryIndex, exerciseIndex, -1) }
                                                        } else {
                                                            null
                                                        },
                                                        onMoveDown = if (exerciseIndex < entry.exercises.lastIndex) {
                                                            { viewModel.moveExercise(entryIndex, exerciseIndex, 1) }
                                                        } else {
                                                            null
                                                        },
                                                    )
                                                },
                                            )
                                        }
                                    }
                                }
                            } else if (!compact) {
                                entry.exercises.forEachIndexed { exerciseIndex, exercise ->
                                    EditorExerciseBlock(
                                        entryIndex = entryIndex,
                                        exerciseIndex = exerciseIndex,
                                        exercise = exercise,
                                        inSuperset = false,
                                        viewModel = viewModel,
                                        onOpen = { onOpenExercise(exercise.exerciseId) },
                                        handle = null,
                                        onInsertBelow = {
                                            picker = EditorPicker.InsertBelow(entryIndex)
                                        },
                                    )
                                }
                            }

                            if (!compact) {
                                GhostButton(
                                    if (superset) "Add to superset" else "Make superset",
                                    onClick = { picker = EditorPicker.AddTo(entryIndex) },
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
                        onClick = { picker = EditorPicker.Add },
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

    picker?.let { target ->
        ExercisePicker(
            exercises = exercises,
            title = when (target) {
                EditorPicker.Add -> "Add exercise"
                is EditorPicker.AddTo -> "Add to superset"
                is EditorPicker.InsertBelow -> "Insert exercise"
            },
            onPick = {
                when (target) {
                    EditorPicker.Add -> viewModel.addEntry(it.id, it.name)
                    is EditorPicker.AddTo -> viewModel.addToEntry(target.entry, it.id, it.name)
                    is EditorPicker.InsertBelow -> viewModel.insertEntry(target.entry, it.id, it.name)
                }
                picker = null
            },
            onDismiss = { picker = null },
        )
    }
}

private sealed interface EditorPicker {
    data object Add : EditorPicker
    /** Add into an existing entry — this is what builds a superset. */
    data class AddTo(val entry: Int) : EditorPicker
    /** Splice a new entry right below this one. */
    data class InsertBelow(val entry: Int) : EditorPicker
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
    /** Null inside a superset — insert is entry-level, on the header menu. */
    onInsertBelow: (() -> Unit)? = null,
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
            if (onInsertBelow != null) {
                LiftMenu(
                    items = listOf(
                        LiftMenuItem(
                            "Insert exercise below",
                            LiftIcons.RowInsertBottom,
                            onClick = onInsertBelow,
                        ),
                        LiftMenuItem("Remove", LiftIcons.Trash, danger = true) {
                            viewModel.removeExercise(entryIndex, exerciseIndex)
                        },
                    ),
                    size = 32.dp,
                    iconSize = 14.dp,
                )
            } else {
                LiftIconButton(
                    LiftIcons.Trash,
                    onClick = { viewModel.removeExercise(entryIndex, exerciseIndex) },
                    size = 32.dp,
                    iconSize = 14.dp,
                    danger = true,
                )
            }
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
