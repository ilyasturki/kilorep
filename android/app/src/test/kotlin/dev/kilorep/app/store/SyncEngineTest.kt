package dev.kilorep.app.store

import dev.kilorep.api.models.WorkoutInput
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertIs
import kotlin.test.assertTrue

private fun draft(
    localId: String = "local-1",
    serverId: Int? = null,
    sessionId: Int? = 7,
    completed: Boolean = true,
    dirty: Boolean = true,
    reps: Int? = 8,
) = WorkoutDraft(
    localId = localId,
    serverId = serverId,
    sessionId = sessionId,
    name = "Push Day",
    startedAt = "2026-06-12T18:00:00Z",
    completed = completed,
    dirty = dirty,
    entries = listOf(
        DraftEntry(
            exercises = listOf(
                DraftExercise(
                    exerciseId = 3,
                    name = "Bench Press",
                    sets = listOf(
                        DraftSet(reps = reps, weight = 80.0, done = true, target = 8),
                        DraftSet(reps = null, weight = null, done = false, target = 8),
                    ),
                ),
            ),
        ),
    ),
)

/** Records calls; scripted to fail per operation. */
private class FakeTransport(
    var nextServerId: Int = 101,
    var failCreate: SyncException? = null,
    var failSave: SyncException? = null,
) : SyncTransport {
    val created = mutableListOf<Int>()
    val saved = mutableListOf<Pair<Int, WorkoutInput>>()

    override fun create(sessionId: Int): Int {
        failCreate?.let { throw it }
        created += sessionId
        return nextServerId
    }

    override fun save(serverId: Int, input: WorkoutInput) {
        failSave?.let { throw it }
        saved += serverId to input
    }
}

class SyncEngineTest {

    @Test
    fun `offline-created draft replays as create then put`() {
        val transport = FakeTransport(nextServerId = 42)
        val outcomes = SyncEngine(transport).sync(listOf(draft()))

        assertEquals(listOf(7), transport.created)
        assertEquals(1, transport.saved.size)
        assertEquals(42, transport.saved[0].first)
        val outcome = assertIs<SyncOutcome.Synced>(outcomes.single())
        assertEquals(42, outcome.serverId)
        assertEquals("local-1", outcome.localId)
    }

    @Test
    fun `draft already known to the server skips creation`() {
        val transport = FakeTransport()
        val outcomes = SyncEngine(transport).sync(listOf(draft(serverId = 55)))

        assertTrue(transport.created.isEmpty())
        assertEquals(55, transport.saved.single().first)
        assertEquals(55, assertIs<SyncOutcome.Synced>(outcomes.single()).serverId)
    }

    @Test
    fun `replay payload carries the whole tree`() {
        val transport = FakeTransport()
        SyncEngine(transport).sync(listOf(draft(serverId = 55)))

        val input = transport.saved.single().second
        assertEquals("Push Day", input.name)
        assertEquals(true, input.completed)
        val sets = input.entries.single().exercises.single().sets
        assertEquals(2, sets.size)
        assertEquals(8, sets[0].reps)
        assertEquals(80.0, sets[0].weight)
        assertEquals(true, sets[0].done)
        // A cleared set keeps its slot with nulls — autosave can't drop rows.
        assertEquals(null, sets[1].reps)
        assertEquals(null, sets[1].weight)
    }

    @Test
    fun `clean drafts are not replayed`() {
        val transport = FakeTransport()
        val outcomes = SyncEngine(transport).sync(listOf(draft(dirty = false)))

        assertTrue(outcomes.isEmpty())
        assertTrue(transport.created.isEmpty() && transport.saved.isEmpty())
    }

    @Test
    fun `deleted template makes the draft uncreatable, not retried forever`() {
        val transport = FakeTransport(
            failCreate = SyncException("Session not found", retryable = false),
        )
        val outcome = SyncEngine(transport).sync(listOf(draft())).single()

        val failed = assertIs<SyncOutcome.Failed>(outcome)
        assertEquals(false, failed.retryable)
        assertTrue(transport.saved.isEmpty())
    }

    @Test
    fun `network failure stays in the queue as retryable`() {
        val transport = FakeTransport(
            failSave = SyncException("timeout", retryable = true),
        )
        val outcome = SyncEngine(transport).sync(listOf(draft(serverId = 9))).single()

        assertTrue(assertIs<SyncOutcome.Failed>(outcome).retryable)
    }

    @Test
    fun `created id survives a failed save — retry puts instead of duplicating`() {
        val transport = FakeTransport(
            nextServerId = 77,
            failSave = SyncException("timeout", retryable = true),
        )
        val recorded = mutableMapOf<String, Int>()
        val engine = SyncEngine(transport) { localId, serverId ->
            recorded[localId] = serverId
        }

        val first = engine.sync(listOf(draft())).single()

        // Create landed, save did not: the hook must already hold the id.
        assertTrue(assertIs<SyncOutcome.Failed>(first).retryable)
        assertEquals(listOf(7), transport.created)
        assertEquals(mapOf("local-1" to 77), recorded)

        // The retry replays the draft with the recorded id (what Repo
        // persists through the hook): save only, no second create.
        transport.failSave = null
        val second = engine.sync(listOf(draft(serverId = recorded["local-1"]))).single()

        assertEquals(77, assertIs<SyncOutcome.Synced>(second).serverId)
        assertEquals(listOf(7), transport.created)
        assertEquals(77, transport.saved.single().first)
    }

    @Test
    fun `hook is not invoked for drafts already known to the server`() {
        val transport = FakeTransport()
        val recorded = mutableMapOf<String, Int>()
        SyncEngine(transport) { localId, serverId -> recorded[localId] = serverId }
            .sync(listOf(draft(serverId = 55)))

        assertTrue(recorded.isEmpty())
    }

    @Test
    fun `unknown failures default to retryable — never drop a workout`() {
        val transport = object : SyncTransport {
            override fun create(sessionId: Int): Int = error("boom")
            override fun save(serverId: Int, input: WorkoutInput) = Unit
        }
        val outcome = SyncEngine(transport).sync(listOf(draft())).single()

        assertTrue(assertIs<SyncOutcome.Failed>(outcome).retryable)
    }

    @Test
    fun `one failing draft does not block the rest`() {
        val transport = object : SyncTransport {
            val saved = mutableListOf<Int>()
            override fun create(sessionId: Int): Int =
                if (sessionId == 7) throw SyncException("gone", retryable = false) else 200

            override fun save(serverId: Int, input: WorkoutInput) {
                saved += serverId
            }
        }
        val outcomes = SyncEngine(transport).sync(
            listOf(draft(localId = "a", sessionId = 7), draft(localId = "b", sessionId = 8)),
        )

        assertIs<SyncOutcome.Failed>(outcomes[0])
        assertEquals(200, assertIs<SyncOutcome.Synced>(outcomes[1]).serverId)
        assertEquals(listOf(200), transport.saved)
    }

    @Test
    fun `draft with nothing usable fails fast instead of hitting the server`() {
        val transport = FakeTransport()
        val empty = draft().copy(entries = emptyList())
        val outcome = SyncEngine(transport).sync(listOf(empty)).single()

        val failed = assertIs<SyncOutcome.Failed>(outcome)
        assertEquals(false, failed.retryable)
        assertTrue(transport.created.isEmpty() && transport.saved.isEmpty())
    }
}
