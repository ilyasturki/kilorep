package dev.kilorep.app.data

import com.squareup.moshi.JsonAdapter
import com.squareup.moshi.Types
import dev.kilorep.api.models.Bodyweight
import dev.kilorep.api.models.BodyweightInput
import dev.kilorep.api.models.Exercise
import dev.kilorep.api.models.ExerciseInput
import dev.kilorep.api.models.MergeInput
import dev.kilorep.api.models.ReorderInput
import dev.kilorep.api.models.SessionInput
import dev.kilorep.api.models.SessionWithEntries
import dev.kilorep.api.models.StartWorkoutInput
import dev.kilorep.api.models.TemplateStatus
import dev.kilorep.api.models.ToSessionInput
import dev.kilorep.api.models.WorkoutDetail
import dev.kilorep.api.models.WorkoutInput
import dev.kilorep.api.models.WorkoutWithEntries
import dev.kilorep.app.store.SyncEngine
import dev.kilorep.app.store.SyncOutcome
import dev.kilorep.app.store.SyncTransport
import dev.kilorep.app.store.WorkoutDraft
import java.time.OffsetDateTime
import java.util.UUID
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/** Per-draft sync visibility (user story: "is my workout on the server?"). */
sealed interface SyncStatus {
    data object Pending : SyncStatus
    data object Syncing : SyncStatus
    data class Error(val reason: String, val retryable: Boolean) : SyncStatus
}

/**
 * The app's single data orchestrator. Reads serve cache first and refresh
 * over the network; the gym loop writes drafts locally and replays them
 * through [SyncEngine]. Everything network runs on IO.
 */
class Repo(
    private val backend: Backend,
    private val files: JsonStore,
    private val onDirtyDrafts: () -> Unit,
) {
    private val draftsAdapter = files.moshi.adapter<List<WorkoutDraft>>(
        Types.newParameterizedType(List::class.java, WorkoutDraft::class.java),
    )
    private val sessionsAdapter = files.moshi.adapter<List<SessionWithEntries>>(
        Types.newParameterizedType(List::class.java, SessionWithEntries::class.java),
    )
    private val exercisesAdapter = files.moshi.adapter<List<Exercise>>(
        Types.newParameterizedType(List::class.java, Exercise::class.java),
    )
    private val workoutsAdapter = files.moshi.adapter<List<WorkoutWithEntries>>(
        Types.newParameterizedType(List::class.java, WorkoutWithEntries::class.java),
    )
    private val bodyweightAdapter = files.moshi.adapter<List<Bodyweight>>(
        Types.newParameterizedType(List::class.java, Bodyweight::class.java),
    )

    val drafts = MutableStateFlow(files.read("drafts.json", draftsAdapter) ?: emptyList())
    val sessions = MutableStateFlow(files.read("sessions.json", sessionsAdapter) ?: emptyList())
    val exercises = MutableStateFlow(files.read("exercises.json", exercisesAdapter) ?: emptyList())
    val workouts = MutableStateFlow(files.read("workouts.json", workoutsAdapter) ?: emptyList())
    val bodyweight = MutableStateFlow(files.read("bodyweight.json", bodyweightAdapter) ?: emptyList())

    private val _syncStatus = MutableStateFlow<Map<String, SyncStatus>>(emptyMap())
    val syncStatus: StateFlow<Map<String, SyncStatus>> get() = _syncStatus

    private val syncMutex = Mutex()

    // Every cache-file write rides one lane: keystroke-time persists leave
    // the caller's thread, queued writes execute in order, and clearLocalData
    // can slot its deletions behind any write already in flight.
    private val persistLane = Dispatchers.IO.limitedParallelism(1)
    private val persistScope = CoroutineScope(SupervisorJob() + persistLane)

    private fun <T> persistLater(name: String, adapter: JsonAdapter<T>, value: () -> T) {
        // The value is read at execution time, so a queued stale write can
        // never clobber a newer one (latest wins).
        persistScope.launch { files.write(name, adapter, value()) }
    }

    // ── Cached reads ────────────────────────────────────────────────────────

    suspend fun refreshSessions(): Result<List<SessionWithEntries>> = io {
        backend.sessions.listSessions().also {
            sessions.value = it
            files.write("sessions.json", sessionsAdapter, it)
        }
    }

    suspend fun refreshExercises(): Result<List<Exercise>> = io {
        backend.exercises.listExercises().also {
            exercises.value = it
            files.write("exercises.json", exercisesAdapter, it)
        }
    }

    suspend fun refreshWorkouts(): Result<List<WorkoutWithEntries>> = io {
        backend.workouts.listWorkouts().also {
            workouts.value = it
            files.write("workouts.json", workoutsAdapter, it)
        }
    }

    suspend fun refreshBodyweight(): Result<List<Bodyweight>> = io {
        backend.bodyweight.listBodyweight().also {
            bodyweight.value = it
            files.write("bodyweight.json", bodyweightAdapter, it)
        }
    }

    /** Everything the home screen needs, refreshed opportunistically. */
    suspend fun refreshAll() {
        // Independent fetches, and each one already swallows its own failure
        // through io/runCatching, so they can overlap safely.
        coroutineScope {
            launch { refreshSessions() }
            launch { refreshExercises() }
            launch { refreshWorkouts() }
        }
    }

    // ── The gym loop: drafts ────────────────────────────────────────────────

    /** Starts a workout from a cached session — works in a dead zone. */
    fun startWorkout(session: SessionWithEntries): WorkoutDraft {
        // One active workout at a time (web's invariant): if something is
        // already in progress, hand that back rather than open a second. The
        // CTA already shows "Continue" in that case; this is the backstop.
        drafts.value.firstOrNull { !it.completed }?.let { return it }
        val draft = WorkoutDraft.fromSession(
            session,
            localId = UUID.randomUUID().toString(),
            startedAt = OffsetDateTime.now().toString(),
        )
        putDraft(draft)
        return draft
    }

    /** Reopens a server workout in the logging screen. */
    suspend fun openWorkout(serverId: Int): Result<WorkoutDraft> {
        val cached = drafts.value.firstOrNull { it.serverId == serverId }
        // A dirty cached draft is local truth and must never be clobbered; a
        // clean one may lag behind web edits, so prefer a fresh fetch and
        // only fall back to the cache when the fetch fails (offline).
        if (cached != null && cached.dirty) return Result.success(cached)
        val fresh = io {
            val detail = backend.workouts.getWorkout(serverId)
            WorkoutDraft.fromWorkout(detail, cached?.localId ?: UUID.randomUUID().toString())
                .also { if (cached == null) putDraft(it) else updateDraftQuietly(it) }
        }
        return if (fresh.isFailure && cached != null) Result.success(cached) else fresh
    }

    fun draft(localId: String): WorkoutDraft? =
        drafts.value.firstOrNull { it.localId == localId }

    /** Every gym-loop mutation lands here: persist first, sync later. */
    fun updateDraft(draft: WorkoutDraft) {
        drafts.update { list ->
            list.map { if (it.localId == draft.localId) draft else it }
        }
        persistDrafts()
        if (draft.dirty) onDirtyDrafts()
    }

    fun discardDraft(localId: String) {
        drafts.update { list -> list.filterNot { it.localId == localId } }
        _syncStatus.update { it - localId }
        persistDrafts()
    }

    /** The active workout: at most one incomplete draft is kept around. */
    val activeDraft: WorkoutDraft?
        get() = drafts.value.firstOrNull { !it.completed }

    private fun putDraft(draft: WorkoutDraft) {
        drafts.update { it + draft }
        persistDrafts()
    }

    private fun persistDrafts() {
        persistLater("drafts.json", draftsAdapter) { drafts.value }
    }

    // ── Sync: opportunistic replay ──────────────────────────────────────────

    private val transport = object : SyncTransport {
        override fun create(sessionId: Int): Int =
            try {
                backend.workouts.startWorkout(StartWorkoutInput(sessionId)).id
            } catch (e: Exception) {
                throw e.toSyncException()
            }

        override fun save(serverId: Int, input: WorkoutInput) {
            try {
                backend.workouts.saveWorkout(serverId, input)
            } catch (e: Exception) {
                throw e.toSyncException()
            }
        }
    }

    private val engine = SyncEngine(transport, onCreated = ::recordServerId)

    /**
     * The moment a create lands, the server identity is persisted — even if
     * the follow-up save fails or the worker dies before outcomes process,
     * the next replay PUTs this id instead of creating a duplicate workout.
     */
    private fun recordServerId(localId: String, serverId: Int) {
        drafts.update { list ->
            list.map { if (it.localId == localId) it.copy(serverId = serverId) else it }
        }
        persistDrafts()
    }

    /**
     * Replays every dirty draft. Completed drafts that synced move out of
     * the draft store — from then on history serves them from the server.
     *
     * Returns true when retryable dirty work remains (failed-but-retryable
     * drafts, or drafts edited while their snapshot was in flight), so the
     * sync worker knows to come back.
     */
    suspend fun syncNow(): Boolean = syncMutex.withLock {
        val dirty = drafts.value.filter { it.dirty }
        if (dirty.isEmpty()) return false
        _syncStatus.update { status ->
            status + dirty.associate { it.localId to SyncStatus.Syncing }
        }
        val sent = dirty.associateBy { it.localId }

        val outcomes = withContext(Dispatchers.IO) { engine.sync(dirty) }

        for (outcome in outcomes) {
            when (outcome) {
                is SyncOutcome.Synced -> {
                    val draft = draft(outcome.localId) ?: continue
                    // Identity fields may have changed mid-flight (the
                    // engine's onCreated stamps serverId); only the tree the
                    // user can edit decides whether this outcome is current.
                    val snapshot = sent.getValue(outcome.localId)
                    val edited = draft.copy(serverId = null, dirty = false) !=
                        snapshot.copy(serverId = null, dirty = false)
                    if (edited) {
                        // The server holds a stale tree: keep the draft dirty
                        // so the next replay PUTs the newer one, but record
                        // the identity so it does not create a duplicate.
                        updateDraftQuietly(draft.copy(serverId = outcome.serverId))
                        _syncStatus.update { it - draft.localId }
                    } else if (draft.completed) {
                        discardDraft(draft.localId)
                    } else {
                        updateDraftQuietly(
                            draft.copy(serverId = outcome.serverId, dirty = false),
                        )
                        _syncStatus.update { it - draft.localId }
                    }
                }
                is SyncOutcome.Failed -> {
                    _syncStatus.update {
                        it + (outcome.localId to SyncStatus.Error(
                            outcome.reason,
                            outcome.retryable,
                        ))
                    }
                }
            }
        }
        if (outcomes.any { it is SyncOutcome.Synced }) refreshWorkouts()
        drafts.value.any { draft ->
            draft.dirty &&
                (_syncStatus.value[draft.localId] as? SyncStatus.Error)?.retryable != false
        }
    }

    /** Sync bookkeeping must not re-mark the draft dirty. */
    private fun updateDraftQuietly(draft: WorkoutDraft) {
        drafts.update { list ->
            list.map { if (it.localId == draft.localId) draft else it }
        }
        persistDrafts()
    }

    // ── Online-only passthroughs (management surfaces) ─────────────────────

    suspend fun workoutDetail(id: Int): Result<WorkoutDetail> =
        io { backend.workouts.getWorkout(id) }

    suspend fun deleteWorkout(id: Int): Result<Unit> = io {
        backend.workouts.deleteWorkout(id)
        workouts.update { list -> list.filterNot { it.id == id } }
        // Without rewriting the cache the deletion resurrects from stale
        // JSON after process death.
        persistLater("workouts.json", workoutsAdapter) { workouts.value }
    }

    suspend fun workoutToSession(id: Int, input: ToSessionInput): Result<TemplateStatus> =
        io { backend.workouts.workoutToSession(id, input) }
            .also { refreshSessions() }

    suspend fun createSession(input: SessionInput): Result<Unit> =
        io { backend.sessions.createSession(input) }.map { refreshSessions(); Unit }

    suspend fun replaceSession(id: Int, input: SessionInput): Result<Unit> =
        io { backend.sessions.replaceSession(id, input) }.map { refreshSessions(); Unit }

    suspend fun deleteSession(id: Int): Result<Unit> =
        io { backend.sessions.deleteSession(id) }.map { refreshSessions(); Unit }

    suspend fun reorderSessions(ids: List<Int>): Result<Unit> =
        io { backend.sessions.reorderSessions(ReorderInput(ids)) }.map { refreshSessions(); Unit }

    suspend fun exerciseDetail(id: Int) = io { backend.exercises.getExercise(id) }

    suspend fun createExercise(input: ExerciseInput): Result<Exercise> =
        io { backend.exercises.createExercise(input) }.also { refreshExercises() }

    suspend fun updateExercise(id: Int, input: ExerciseInput): Result<Exercise> =
        io { backend.exercises.updateExercise(id, input) }.also { refreshExercises() }

    suspend fun deleteExercise(id: Int): Result<Exercise> =
        io { backend.exercises.deleteExercise(id) }.also { refreshExercises() }

    suspend fun mergeExercise(id: Int, targetId: Int): Result<Exercise> =
        io { backend.exercises.mergeExercise(id, MergeInput(targetId)) }
            .also { refreshExercises() }

    suspend fun logBodyweight(input: BodyweightInput): Result<Bodyweight> =
        io { backend.bodyweight.logBodyweight(input) }.also { refreshBodyweight() }

    suspend fun updateBodyweight(id: Int, input: BodyweightInput): Result<Bodyweight> =
        io { backend.bodyweight.updateBodyweight(id, input) }.also { refreshBodyweight() }

    suspend fun deleteBodyweight(id: Int): Result<Unit> = io {
        backend.bodyweight.deleteBodyweight(id)
        bodyweight.update { list -> list.filterNot { it.id == id } }
        persistLater("bodyweight.json", bodyweightAdapter) { bodyweight.value }
    }

    /**
     * Wipe-on-auth-change: another account's data must never bleed through.
     * Takes the sync mutex so an in-flight replay finishes (and stops) before
     * the wipe — otherwise old-account drafts would POST to the new identity,
     * since the transport resolves URL and token per request.
     */
    suspend fun clearLocalData() = syncMutex.withLock {
        drafts.value = emptyList()
        sessions.value = emptyList()
        exercises.value = emptyList()
        workouts.value = emptyList()
        bodyweight.value = emptyList()
        _syncStatus.value = emptyMap()
        // Flows are emptied first, and the deletions ride the persist lane,
        // so a queued persist re-reads empty state and cannot resurrect the
        // wiped files afterwards.
        withContext(persistLane) {
            listOf(
                "drafts.json", "sessions.json", "exercises.json",
                "workouts.json", "bodyweight.json",
            ).forEach(files::delete)
        }
    }

    private suspend fun <T> io(block: () -> T): Result<T> =
        withContext(Dispatchers.IO) { runCatching(block) }
}
