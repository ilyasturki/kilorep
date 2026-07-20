package dev.kilorep.app.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.kilorep.api.models.PrescribedSetInput
import dev.kilorep.api.models.SessionEntryInput
import dev.kilorep.api.models.SessionExerciseInput
import dev.kilorep.api.models.SessionInput
import dev.kilorep.api.models.SessionWithEntries
import dev.kilorep.app.data.Repo
import dev.kilorep.app.data.userMessage
import dev.kilorep.app.ui.moved
import dev.kilorep.app.ui.movedByKey
import java.util.UUID
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.launch

data class EditExercise(
    val exerciseId: Int,
    val name: String,
    /** Rep targets; null = open target, decided at workout time. */
    val sets: List<Int?>,
)

/** One entry; more than one exercise makes it a superset. */
data class EditEntry(
    val exercises: List<EditExercise>,
    /** UI list identity for drag reorder; never persisted. */
    val id: String = UUID.randomUUID().toString(),
)

/**
 * Editable session-template tree. Entries and exercises move by handle drag
 * (with explicit up/down kept as accessibility actions). Saving rewrites the
 * whole tree, like the web.
 */
class SessionEditorViewModel(
    private val repo: Repo,
    private val sessionId: Int?,
) : ViewModel() {

    val name = MutableStateFlow("")
    val entries = MutableStateFlow<List<EditEntry>>(emptyList())
    val busy = MutableStateFlow(false)
    val error = MutableStateFlow<String?>(null)
    val saved = MutableStateFlow(false)

    init {
        if (sessionId != null) {
            repo.sessions.value.firstOrNull { it.id == sessionId }?.let(::load)
        }
    }

    private fun load(session: SessionWithEntries) {
        name.value = session.name
        entries.value = session.entries
            .sortedBy { it.position }
            .map { entry ->
                EditEntry(
                    exercises = entry.exercises
                        .sortedBy { it.position }
                        .map { exercise ->
                            EditExercise(
                                exerciseId = exercise.exerciseId,
                                name = exercise.exercise.name,
                                sets = exercise.sets.sortedBy { it.position }.map { it.reps },
                            )
                        },
                )
            }
    }

    val canSave: Boolean
        get() = name.value.isNotBlank()
            && entries.value.any { it.exercises.any { ex -> ex.sets.isNotEmpty() } }

    fun setName(value: String) {
        name.value = value
    }

    fun addEntry(exerciseId: Int, exerciseName: String) {
        entries.value += EditEntry(
            exercises = listOf(EditExercise(exerciseId, exerciseName, sets = listOf(null))),
        )
    }

    /** Adds into an existing entry — this is what builds a superset. */
    fun addToEntry(entryIndex: Int, exerciseId: Int, exerciseName: String) {
        mapEntry(entryIndex) {
            it.copy(
                exercises = it.exercises + EditExercise(exerciseId, exerciseName, listOf(null)),
            )
        }
    }

    fun removeExercise(entryIndex: Int, exerciseIndex: Int) {
        mapEntry(entryIndex) { entry ->
            entry.copy(exercises = entry.exercises.filterIndexed { i, _ -> i != exerciseIndex })
        }
        entries.value = entries.value.filter { it.exercises.isNotEmpty() }
    }

    fun moveEntry(index: Int, delta: Int) {
        entries.value = entries.value.moved(index, index + delta)
    }

    /** Drag reorder lands here with item keys; resolved at apply time. */
    fun moveEntry(fromId: String, toId: String) {
        entries.value = entries.value.movedByKey(fromId, toId) { it.id }
    }

    /** Reorders a superset's rotation. */
    fun moveExercise(entryIndex: Int, exerciseIndex: Int, delta: Int) =
        moveExerciseTo(entryIndex, exerciseIndex, exerciseIndex + delta)

    /** Same, but with the from→to shape a settled drag reports. */
    fun moveExerciseTo(entryIndex: Int, from: Int, to: Int) {
        mapEntry(entryIndex) { it.copy(exercises = it.exercises.moved(from, to)) }
    }

    fun addSet(entryIndex: Int, exerciseIndex: Int) {
        mapExercise(entryIndex, exerciseIndex) { it.copy(sets = it.sets + it.sets.lastOrNull()) }
    }

    fun removeSet(entryIndex: Int, exerciseIndex: Int, setIndex: Int) {
        mapExercise(entryIndex, exerciseIndex) {
            it.copy(sets = it.sets.filterIndexed { i, _ -> i != setIndex })
        }
        // An exercise with no sets would be silently dropped by the server on
        // save; prune it here so what the editor shows is what gets saved.
        mapEntry(entryIndex) { entry ->
            entry.copy(exercises = entry.exercises.filter { it.sets.isNotEmpty() })
        }
        entries.value = entries.value.filter { it.exercises.isNotEmpty() }
    }

    fun setReps(entryIndex: Int, exerciseIndex: Int, setIndex: Int, reps: Int?) {
        mapExercise(entryIndex, exerciseIndex) {
            it.copy(sets = it.sets.mapIndexed { i, r -> if (i == setIndex) reps else r })
        }
    }

    fun save() {
        if (!canSave) return
        busy.value = true
        error.value = null
        val input = SessionInput(
            name = name.value.trim(),
            entries = entries.value
                .filter { it.exercises.isNotEmpty() }
                .map { entry ->
                    SessionEntryInput(
                        exercises = entry.exercises.map { exercise ->
                            SessionExerciseInput(
                                exerciseId = exercise.exerciseId,
                                sets = exercise.sets.map { PrescribedSetInput(reps = it) },
                            )
                        },
                    )
                },
        )
        viewModelScope.launch {
            val result =
                if (sessionId == null) {
                    repo.createSession(input)
                } else {
                    repo.replaceSession(sessionId, input)
                }
            result
                .onSuccess { saved.value = true }
                .onFailure { error.value = it.userMessage() }
            busy.value = false
        }
    }

    private fun mapEntry(index: Int, transform: (EditEntry) -> EditEntry) {
        entries.value = entries.value.mapIndexed { i, entry ->
            if (i == index) transform(entry) else entry
        }
    }

    private fun mapExercise(
        entryIndex: Int,
        exerciseIndex: Int,
        transform: (EditExercise) -> EditExercise,
    ) {
        mapEntry(entryIndex) { entry ->
            entry.copy(
                exercises = entry.exercises.mapIndexed { i, exercise ->
                    if (i == exerciseIndex) transform(exercise) else exercise
                },
            )
        }
    }
}
