package dev.kilorep.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.kilorep.api.models.ToSessionInput
import dev.kilorep.app.data.SyncStatus
import dev.kilorep.app.store.DraftEntry
import dev.kilorep.app.store.DraftExercise
import dev.kilorep.app.store.WorkoutDraft
import dev.kilorep.app.store.loadFactor
import dev.kilorep.app.ui.components.ConfirmDialog
import dev.kilorep.app.ui.components.EntryDragHandle
import dev.kilorep.app.ui.components.ExercisePicker
import dev.kilorep.app.ui.components.GhostButton
import dev.kilorep.app.ui.components.Kicker
import dev.kilorep.app.ui.components.LiftCard
import dev.kilorep.app.ui.components.LiftDialogCard
import dev.kilorep.app.ui.components.LiftIconButton
import dev.kilorep.app.ui.components.LiftMenu
import dev.kilorep.app.ui.components.LiftMenuItem
import dev.kilorep.app.ui.components.LiftScreen
import dev.kilorep.app.ui.components.LiftTextField
import dev.kilorep.app.ui.components.PrimaryButton
import dev.kilorep.app.ui.components.StatCell
import dev.kilorep.app.ui.components.StepperField
import dev.kilorep.app.ui.components.Tag
import dev.kilorep.app.ui.formatDate
import dev.kilorep.app.ui.formatReps
import dev.kilorep.app.ui.formatVolume
import dev.kilorep.app.ui.formatWeight
import dev.kilorep.app.ui.parseReps
import dev.kilorep.app.ui.parseWeight
import dev.kilorep.app.ui.weightUnit
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcon
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text
import dev.kilorep.app.ui.components.ReorderableEntryHeader
import dev.kilorep.app.ui.components.longPressDrag
import dev.kilorep.app.ui.components.rememberLiftReorder
import java.time.LocalDate
import java.time.OffsetDateTime
import kotlin.math.roundToLong
import sh.calvin.reorderable.ReorderableItem

/**
 * The gym loop and the workout's whole lifecycle (web's /workouts/[id]):
 * in-progress workouts open in edit mode for one-handed logging; finished ones
 * open read-only with an Edit toggle and a guarded Resume. Editing never
 * un-finishes a workout — only Resume does. Everything works offline.
 */
@Composable
fun WorkoutScreen(
    viewModel: WorkoutViewModel,
    exercises: List<dev.kilorep.api.models.Exercise>,
    offline: Boolean,
    onBack: () -> Unit,
    onOpenExercise: (Int) -> Unit,
) {
    val draft by viewModel.draft.collectAsStateWithLifecycle()
    val syncStatus by viewModel.syncStatus.collectAsStateWithLifecycle()
    val template by viewModel.template.collectAsStateWithLifecycle()
    val syncBackResult by viewModel.syncBackResult.collectAsStateWithLifecycle()
    val otherActive by viewModel.otherActive.collectAsStateWithLifecycle()
    val colors = Lift.colors

    var picker by remember { mutableStateOf<PickerTarget?>(null) }
    var confirmRemove by remember { mutableStateOf<Triple<Int, Int, Int?>?>(null) }
    var confirmDiscard by remember { mutableStateOf(false) }
    var confirmResume by remember { mutableStateOf(false) }
    var namingTemplate by remember { mutableStateOf(false) }
    var editingDate by remember { mutableStateOf(false) }

    val current = draft ?: run {
        LaunchedEffect(Unit) { onBack() }
        return
    }

    // `completed` is the persisted status; `editing` is a pure view↔edit
    // toggle. A finished workout opens read-only; an in-progress one in edit.
    var editing by remember { mutableStateOf(!current.completed) }

    LaunchedEffect(current.dirty, current.serverId) {
        if (!current.dirty && current.serverId != null) viewModel.refreshTemplate()
    }

    val listState = rememberLazyListState()
    // While a drag is live every entry collapses to a compact row, so far
    // more drop targets fit on screen than the full cards would allow.
    var reordering by remember { mutableStateOf(false) }
    val reorderState = rememberLiftReorder(listState) { from, to ->
        viewModel.moveEntry(from as String, to as String)
    }
    // The dropped entry's (item index, viewport offset) at finger-up, read
    // while the list is still compact. Re-expanding re-anchors the viewport
    // on whatever item happens to be first, landing somewhere unrelated —
    // this puts the dropped card back where the finger left it.
    var dropAnchor by remember { mutableStateOf<Pair<Int, Int>?>(null) }
    LaunchedEffect(reordering) {
        if (!reordering) {
            dropAnchor?.let { (index, offset) ->
                dropAnchor = null
                // One frame so the re-expanded heights are measured first.
                withFrameNanos { }
                listState.scrollToItem(index, -offset)
            }
        }
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
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .padding(horizontal = 14.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                if (current.completed || syncStatus is SyncStatus.Error) {
                    item { SyncStateRow(current.completed, syncStatus, viewModel) }
                }

                item { StatsRow(current, onEditDate = { editingDate = true }) }

                itemsIndexed(current.entries, key = { _, entry -> entry.id }) { entryIndex, entry ->
                    ReorderableItem(reorderState, key = entry.id) { isDragging ->
                        if (!editing) {
                            LiftCard(padding = 14.dp) {
                                ReviewBlock(entry, onOpenExercise)
                            }
                        } else {
                            val draggable = current.entries.size > 1
                            val onDraggingChange: (Boolean) -> Unit = { dragging ->
                                if (!dragging) {
                                    dropAnchor = listState.layoutInfo.visibleItemsInfo
                                        .firstOrNull { it.key == entry.id }
                                        ?.let { it.index to it.offset }
                                }
                                reordering = dragging
                            }
                            val handle: (@Composable () -> Unit)? =
                                if (draggable) {
                                    {
                                        EntryDragHandle(
                                            index = entryIndex,
                                            lastIndex = current.entries.lastIndex,
                                            onStep = { delta ->
                                                if (delta < 0) {
                                                    viewModel.moveEntryUp(entryIndex)
                                                } else {
                                                    viewModel.moveEntryDown(entryIndex)
                                                }
                                            },
                                            onDraggingChange = onDraggingChange,
                                        )
                                    }
                                } else {
                                    null
                                }
                            EditableEntryCard(
                                entryIndex = entryIndex,
                                entry = entry,
                                viewModel = viewModel,
                                onPicker = { picker = it },
                                onConfirmRemove = { confirmRemove = it },
                                onOpenExercise = onOpenExercise,
                                handle = handle,
                                headerDrag = if (draggable) {
                                    longPressDrag(onDraggingChange = onDraggingChange)
                                } else {
                                    Modifier
                                },
                                compact = reordering && handle != null,
                                dragging = isDragging,
                            )
                        }
                    }
                }

                if (editing) {
                    item {
                        GhostButton(
                            "Add exercise",
                            onClick = { picker = PickerTarget.Add },
                            icon = LiftIcons.Plus,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
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

            // The action bar lives under the thumb, like the web's .wk-actions.
            Column(
                Modifier
                    .fillMaxWidth()
                    .background(colors.bg)
                    .padding(horizontal = 14.dp, vertical = 10.dp)
                    .navigationBarsPadding()
                    .imePadding(),
                verticalArrangement = Arrangement.spacedBy(8.dp),
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
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (editing) {
                            GhostButton(
                                "Done editing",
                                onClick = { editing = false },
                                modifier = Modifier.weight(1f),
                                icon = LiftIcons.Check,
                            )
                        } else {
                            GhostButton(
                                "Edit",
                                onClick = { editing = true },
                                modifier = Modifier.weight(1f),
                                icon = LiftIcons.Pencil,
                            )
                        }
                        GhostButton(
                            "Resume training",
                            onClick = { confirmResume = true },
                            modifier = Modifier.weight(1f),
                            icon = LiftIcons.Play,
                            enabled = !otherActive,
                        )
                    }
                    if (otherActive) {
                        Text(
                            "Finish your active workout before resuming this one.",
                            style = LiftType.secondary,
                            color = colors.ink3,
                        )
                    }
                }
            }
        }
    }

    when (val target = picker) {
        is PickerTarget.Swap -> {
            val replacedId = current.entries.getOrNull(target.entry)
                ?.exercises?.getOrNull(target.exercise)?.exerciseId
            ExercisePicker(
                exercises = exercises,
                title = "Swap exercise",
                similarTo = exercises.firstOrNull { it.id == replacedId },
                excludeIds = setOfNotNull(replacedId),
                onPick = {
                    viewModel.swapExercise(
                        target.entry,
                        target.exercise,
                        it.id,
                        it.name,
                        it.loadMode.value,
                    )
                    picker = null
                },
                onDismiss = { picker = null },
            )
        }
        PickerTarget.Add -> ExercisePicker(
            exercises = exercises,
            title = "Add exercise",
            onPick = {
                viewModel.addExercise(it.id, it.name, it.loadMode.value)
                picker = null
            },
            onDismiss = { picker = null },
        )
        is PickerTarget.Insert -> ExercisePicker(
            exercises = exercises,
            title = "Insert exercise",
            onPick = {
                viewModel.insertExercise(target.entry, it.id, it.name, it.loadMode.value)
                picker = null
            },
            onDismiss = { picker = null },
        )
        null -> Unit
    }

    confirmRemove?.let { (entry, exercise, setIndex) ->
        ConfirmDialog(
            title = if (setIndex == null) "Remove exercise?" else "Remove set ${setIndex + 1}?",
            body = if (setIndex == null) "Its logged sets go with it." else null,
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

    if (confirmResume) {
        ConfirmDialog(
            title = "Resume workout?",
            body = "This marks it in progress again and makes it your active workout. Editing the sets here does not need this.",
            confirmLabel = "Resume training",
            onConfirm = {
                viewModel.resume()
                editing = true
                confirmResume = false
            },
            onDismiss = { confirmResume = false },
        )
    }

    if (editingDate) {
        DateShiftDialog(
            current = remember(current.startedAt) {
                OffsetDateTime.parse(current.startedAt).toLocalDate()
            },
            onPick = { viewModel.setDay(it) },
            onDismiss = { editingDate = false },
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
    /** Splice a new entry right below this one. */
    data class Insert(val entry: Int) : PickerTarget
}

/**
 * Sync is invisible while it works: this row only exists for the Completed
 * tag and the failure state (reason + Retry). Happy-path syncing shows
 * nothing at all.
 */
@Composable
private fun SyncStateRow(
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
        if (status is SyncStatus.Error) {
            Tag("Sync failed")
            Text(
                status.reason,
                style = LiftType.secondary,
                color = colors.danger,
                maxLines = 1,
                modifier = Modifier.weight(1f),
            )
            GhostButton("Retry", onClick = viewModel::retrySync, height = 32.dp)
        }
    }
}

/** Date (tap to edit) · volume · sets — the web's .wk-stats strip. */
@Composable
private fun StatsRow(draft: WorkoutDraft, onEditDate: () -> Unit) {
    val (volume, sets) = remember(draft.entries) {
        var v = 0.0
        var s = 0
        draft.entries.forEach { entry ->
            entry.exercises.forEach { ex ->
                s += ex.sets.size
                val factor = loadFactor(ex.loadMode)
                ex.sets.forEach { v += (it.weight ?: 0.0) * (it.reps ?: 0.0) * factor }
            }
        }
        v.roundToLong() to s
    }
    val day = remember(draft.startedAt) { OffsetDateTime.parse(draft.startedAt).toLocalDate() }
    Row(
        Modifier.fillMaxWidth().padding(top = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        LiftCard(modifier = Modifier.weight(1.3f).clickable(onClick = onEditDate), padding = 12.dp) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                LiftIcon(LiftIcons.Calendar, tint = Lift.colors.ink2, size = 15.dp)
                Text(formatDate(day), style = LiftType.mono, maxLines = 1)
            }
            Text("DATE", style = LiftType.tag, color = Lift.colors.ink3, modifier = Modifier.padding(top = 4.dp))
        }
        StatCell(formatVolume(volume), "VOLUME · KG", Modifier.weight(1f))
        StatCell(sets.toString(), "SETS", Modifier.weight(1f))
    }
}

/**
 * One entry in edit mode: optional superset header + drag handle, then its
 * blocks. `compact` (live drag) hides the blocks and shows the names beside
 * the handle instead — see ReorderableEntryHeader for why the header stays.
 */
@Composable
private fun EditableEntryCard(
    entryIndex: Int,
    entry: DraftEntry,
    viewModel: WorkoutViewModel,
    onPicker: (PickerTarget) -> Unit,
    onConfirmRemove: (Triple<Int, Int, Int?>) -> Unit,
    onOpenExercise: (Int) -> Unit,
    handle: (@Composable () -> Unit)?,
    headerDrag: Modifier,
    compact: Boolean,
    dragging: Boolean,
) {
    LiftCard(
        padding = 12.dp,
        borderColor = if (dragging) Lift.colors.accent else null,
    ) {
        val superset = entry.exercises.size > 1
        if (superset || handle != null) {
            ReorderableEntryHeader(
                kicker = if (superset) "Superset · ${entry.exercises.size} rotated" else null,
                accentKicker = true,
                compactNames = if (compact) entry.exercises.map { it.name } else null,
                handle = handle,
                modifier = headerDrag.padding(bottom = if (compact) 0.dp else 8.dp),
                // Entry-level insert for a superset lives on its header; the
                // member rows' menus stay exercise-level. A single action gets
                // a direct button — a one-item menu would only add a tap.
                actions = if (superset && !compact) {
                    {
                        LiftIconButton(
                            LiftIcons.RowInsertBottom,
                            onClick = { onPicker(PickerTarget.Insert(entryIndex)) },
                            size = 38.dp,
                            iconSize = 17.dp,
                        )
                    }
                } else {
                    null
                },
            )
        }
        if (!compact) {
            entry.exercises.forEachIndexed { exerciseIndex, exercise ->
                ExerciseBlock(
                    entryIndex = entryIndex,
                    exerciseIndex = exerciseIndex,
                    exercise = exercise,
                    rotationTag = if (superset) ('A' + exerciseIndex).toString() else null,
                    viewModel = viewModel,
                    onSwap = { onPicker(PickerTarget.Swap(entryIndex, exerciseIndex)) },
                    onInsertBelow = if (superset) {
                        null
                    } else {
                        { onPicker(PickerTarget.Insert(entryIndex)) }
                    },
                    onRemove = { onConfirmRemove(Triple(entryIndex, exerciseIndex, null)) },
                    onRemoveSet = { setIndex -> onConfirmRemove(Triple(entryIndex, exerciseIndex, setIndex)) },
                    onOpen = { onOpenExercise(exercise.exerciseId) },
                )
            }
        }
    }
}

/** Read-only readout of one entry: load × reps per set. */
@Composable
private fun ReviewBlock(entry: DraftEntry, onOpenExercise: (Int) -> Unit) {
    val colors = Lift.colors
    if (entry.exercises.size > 1) {
        Kicker("Superset", accent = true, modifier = Modifier.padding(bottom = 8.dp))
    }
    entry.exercises.forEachIndexed { i, exercise ->
        val volume = exercise.sets
            .sumOf { (it.weight ?: 0.0) * (it.reps ?: 0.0) * loadFactor(exercise.loadMode) }
            .roundToLong()
        Column(Modifier.padding(top = if (i == 0) 0.dp else 12.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    exercise.name,
                    style = LiftType.rowTitle,
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onOpenExercise(exercise.exerciseId) },
                    maxLines = 2,
                )
                Text("${formatVolume(volume)} kg", style = LiftType.kicker, color = colors.ink3)
            }
            exercise.sets.forEachIndexed { si, set ->
                Row(
                    Modifier.fillMaxWidth().padding(top = 6.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("${si + 1}", style = LiftType.tag, color = colors.ink3)
                    Text(
                        "${formatWeight(set.weight)} ${weightUnit(exercise.loadMode)} × ${formatReps(set.reps)}",
                        style = LiftType.mono,
                        modifier = Modifier.weight(1f),
                    )
                }
            }
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
    /** Null inside a superset — insert is entry-level, on the header menu. */
    onInsertBelow: (() -> Unit)?,
    onRemove: () -> Unit,
    onRemoveSet: (Int) -> Unit,
    onOpen: () -> Unit,
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
                modifier = Modifier
                    .weight(1f)
                    .clickable(onClick = onOpen),
                maxLines = 2,
            )
            LiftMenu(
                items = buildList {
                    add(LiftMenuItem("Swap exercise", LiftIcons.Swap, onClick = onSwap))
                    onInsertBelow?.let {
                        add(LiftMenuItem("Insert exercise below", LiftIcons.RowInsertBottom, onClick = it))
                    }
                    add(LiftMenuItem("Remove", LiftIcons.Trash, danger = true, onClick = onRemove))
                },
            )
        }

        exercise.sets.forEachIndexed { setIndex, set ->
            Column(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 10.dp)
                    .border(1.dp, colors.line)
                    .background(colors.surface)
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
                            // An open set shows the last logged reps where a
                            // prescription would sit — a hint, never a value.
                            when {
                                set.target != null -> append("  ·  TARGET ${set.target}")
                                set.hint != null -> append("  ·  LAST ${formatReps(set.hint)}")
                            }
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
                        suffix = weightUnit(exercise.loadMode).uppercase(),
                        decimal = true,
                        modifier = Modifier.weight(1.15f),
                    )
                    StepperField(
                        value = set.reps?.let(::formatReps) ?: "",
                        onValueChange = {
                            viewModel.setReps(entryIndex, exerciseIndex, setIndex, parseReps(it))
                        },
                        onStep = { viewModel.stepReps(entryIndex, exerciseIndex, setIndex, it) },
                        suffix = "REPS",
                        decimal = true,
                        modifier = Modifier.weight(1f),
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
private fun DateShiftDialog(
    current: LocalDate,
    onPick: (LocalDate) -> Unit,
    onDismiss: () -> Unit,
) {
    val today = LocalDate.now()
    var day by remember { mutableStateOf(current) }
    val colors = Lift.colors
    fun clamp(d: LocalDate) = if (d.isAfter(today)) today else d
    LiftDialogCard(onDismiss = onDismiss) {
        Text("Workout date", style = LiftType.rowTitle)
        Text(formatDate(day), style = LiftType.statNum, color = colors.accentText)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GhostButton("− Week", { day = day.minusWeeks(1) }, Modifier.weight(1f), height = 40.dp)
            GhostButton("− Day", { day = day.minusDays(1) }, Modifier.weight(1f), height = 40.dp)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GhostButton(
                "+ Day",
                { day = clamp(day.plusDays(1)) },
                Modifier.weight(1f),
                height = 40.dp,
                enabled = day.isBefore(today),
            )
            GhostButton(
                "+ Week",
                { day = clamp(day.plusWeeks(1)) },
                Modifier.weight(1f),
                height = 40.dp,
                enabled = day.isBefore(today),
            )
        }
        GhostButton(
            "Today",
            { day = today },
            Modifier.fillMaxWidth(),
            height = 40.dp,
            enabled = day != today,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            GhostButton("Cancel", onDismiss, Modifier.weight(1f))
            PrimaryButton(
                "Set date",
                onClick = {
                    onPick(day)
                    onDismiss()
                },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

@Composable
private fun NewTemplateDialog(onCreate: (String) -> Unit, onDismiss: () -> Unit) {
    var name by remember { mutableStateOf("") }
    LiftDialogCard(onDismiss = onDismiss) {
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
