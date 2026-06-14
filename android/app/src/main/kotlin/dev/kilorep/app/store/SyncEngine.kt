package dev.kilorep.app.store

import dev.kilorep.api.models.WorkoutInput

/**
 * What the sync engine needs from the network, kept abstract so the replay
 * logic is testable against a fake transport (no emulator, no HTTP).
 * Implementations translate their failures into [SyncException].
 */
interface SyncTransport {
    /**
     * POST /api/workouts — creates the workout server-side from its session
     * and returns the server id. The server-seeded tree is irrelevant: the
     * follow-up save replaces it wholesale.
     */
    fun create(sessionId: Int): Int

    /** PUT /api/workouts/{id} — whole-tree replace, last writer wins. */
    fun save(serverId: Int, input: WorkoutInput)
}

/** A sync failure, classified: retryable means "try again when online". */
class SyncException(
    message: String,
    val retryable: Boolean,
    cause: Throwable? = null,
) : Exception(message, cause)

sealed interface SyncOutcome {
    val localId: String

    data class Synced(override val localId: String, val serverId: Int) : SyncOutcome

    data class Failed(
        override val localId: String,
        val reason: String,
        val retryable: Boolean,
    ) : SyncOutcome
}

/**
 * Opportunistic replay at workout granularity (the PRD's offline model): a
 * dirty draft without a server identity is created through its session, then
 * its whole tree is PUT. Conflicts resolve last-writer-wins — this clobber
 * is accepted for a single-lifter account. Drafts fail independently: one
 * dead workout never blocks the rest of the queue.
 */
class SyncEngine(
    private val transport: SyncTransport,
    /**
     * Fires the instant a create succeeds, before the follow-up save: the
     * caller must persist the server id immediately, or a failed save (or a
     * killed worker) would make the next replay create a duplicate workout.
     */
    private val onCreated: (localId: String, serverId: Int) -> Unit = { _, _ -> },
) {

    fun sync(drafts: List<WorkoutDraft>): List<SyncOutcome> =
        drafts.filter { it.dirty }.map { draft -> syncOne(draft) }

    private fun syncOne(draft: WorkoutDraft): SyncOutcome {
        if (!draft.isSyncable) {
            return SyncOutcome.Failed(
                draft.localId,
                "Workout has no sets to sync",
                retryable = false,
            )
        }
        return try {
            val serverId = draft.serverId
                ?: draft.sessionId?.let { sessionId ->
                    transport.create(sessionId).also { onCreated(draft.localId, it) }
                }
                ?: return SyncOutcome.Failed(
                    draft.localId,
                    "Workout has no session to be created from",
                    retryable = false,
                )
            transport.save(serverId, draft.toInput())
            SyncOutcome.Synced(draft.localId, serverId)
        } catch (e: SyncException) {
            SyncOutcome.Failed(draft.localId, e.message ?: "Sync failed", e.retryable)
        } catch (e: Exception) {
            // Unknown failures stay in the queue: dropping a logged workout
            // is the one unacceptable outcome.
            SyncOutcome.Failed(draft.localId, e.message ?: "Sync failed", retryable = true)
        }
    }
}
