package dev.kilorep.app.ui.screens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dev.kilorep.api.models.TemplateStatus
import dev.kilorep.api.models.ToSessionInput
import dev.kilorep.app.data.Repo
import dev.kilorep.app.data.SyncStatus
import dev.kilorep.app.data.userMessage
import dev.kilorep.app.store.WorkoutDraft
import dev.kilorep.app.ui.roundWeight
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

/**
 * The gym loop's state holder. Every mutation goes through the draft's pure
 * operations and lands in the repo immediately — the draft on disk is always
 * current, so process death can never lose a set.
 */
class WorkoutViewModel(
    private val repo: Repo,
    private val localId: String,
) : ViewModel() {

    private val vmScope get() = viewModelScope

    val draft: StateFlow<WorkoutDraft?> = repo.drafts
        .map { list -> list.firstOrNull { it.localId == localId } }
        .stateIn(vmScope, SharingStarted.Eagerly, repo.draft(localId))

    val syncStatus: StateFlow<SyncStatus?> = repo.syncStatus
        .map { it[localId] }
        .stateIn(vmScope, SharingStarted.Eagerly, null)

    /** Template link for the sync-back affordance; null until known. */
    val template = MutableStateFlow<TemplateStatus?>(null)
    val syncBackResult = MutableStateFlow<String?>(null)

    private fun update(transform: (WorkoutDraft) -> WorkoutDraft) {
        repo.draft(localId)?.let { repo.updateDraft(transform(it)) }
    }

    fun setReps(entry: Int, exercise: Int, set: Int, reps: Int?) =
        update { it.updateSet(entry, exercise, set) { s -> s.copy(reps = reps) } }

    fun setWeight(entry: Int, exercise: Int, set: Int, weight: Double?) =
        update { it.updateSet(entry, exercise, set) { s -> s.copy(weight = weight) } }

    fun stepReps(entry: Int, exercise: Int, set: Int, delta: Int) =
        update {
            it.updateSet(entry, exercise, set) { s ->
                s.copy(reps = ((s.reps ?: 0) + delta).coerceAtLeast(0).takeIf { r -> r > 0 })
            }
        }

    /** Plates go 2.5 kg at a time. */
    fun stepWeight(entry: Int, exercise: Int, set: Int, delta: Int) =
        update {
            it.updateSet(entry, exercise, set) { s ->
                // Typed weights are arbitrary doubles; adding 2.5 to them
                // drifts in binary, so quantize what gets stored.
                val next = roundWeight(((s.weight ?: 0.0) + delta * 2.5).coerceAtLeast(0.0))
                s.copy(weight = next.takeIf { w -> w > 0.0 })
            }
        }

    fun toggleDone(entry: Int, exercise: Int, set: Int) =
        update { it.updateSet(entry, exercise, set) { s -> s.copy(done = !s.done) } }

    fun addSet(entry: Int, exercise: Int) = update { it.addSet(entry, exercise) }

    fun removeSet(entry: Int, exercise: Int, set: Int) =
        update { it.removeSet(entry, exercise, set) }

    fun swapExercise(entry: Int, exercise: Int, exerciseId: Int, name: String) =
        update { it.swapExercise(entry, exercise, exerciseId, name) }

    fun addExercise(exerciseId: Int, name: String) =
        update { it.addExercise(exerciseId, name) }

    fun removeExercise(entry: Int, exercise: Int) =
        update { it.removeExercise(entry, exercise) }

    fun rename(name: String) {
        if (name.isNotBlank()) update { it.copy(name = name.trim(), dirty = true) }
    }

    /** Finish = complete + replay attempt; offline just leaves it queued. */
    fun finish() {
        update { it.finish() }
        vmScope.launch { repo.syncNow() }
    }

    fun reopen() = update { it.copy(completed = false, dirty = true) }

    fun retrySync() {
        vmScope.launch { repo.syncNow() }
    }

    fun discard() = repo.discardDraft(localId)

    /**
     * The sync-back affordance (CONTEXT.md: Diverged) only makes sense once
     * the server holds the latest tree — refresh after the draft turns clean.
     */
    fun refreshTemplate() {
        val current = repo.draft(localId) ?: return
        val serverId = current.serverId ?: return
        if (current.dirty) return
        vmScope.launch {
            repo.workoutDetail(serverId).onSuccess { template.value = it.template }
        }
    }

    fun syncBack(mode: ToSessionInput.Mode, name: String?) {
        val serverId = repo.draft(localId)?.serverId ?: return
        vmScope.launch {
            repo.workoutToSession(serverId, ToSessionInput(mode = mode, name = name))
                .onSuccess {
                    template.value = it
                    syncBackResult.value = "Saved to “${it.name}”"
                }
                .onFailure { syncBackResult.value = it.userMessage() }
        }
    }
}
