package dev.kilorep.app.store

import dev.kilorep.api.infrastructure.Serializer
import dev.kilorep.api.models.Exercise
import dev.kilorep.api.models.PrescribedSet
import dev.kilorep.api.models.SessionEntry
import dev.kilorep.api.models.SessionExercise
import dev.kilorep.api.models.SessionWithEntries
import java.time.OffsetDateTime
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

private fun exercise(id: Int, name: String) = Exercise(
    id = id,
    userId = 1,
    name = name,
    equipment = Exercise.Equipment.barbell,
    type = Exercise.Type.compound,
    muscles = emptyList(),
    aliases = emptyList(),
)

private fun session() = SessionWithEntries(
    id = 7,
    userId = 1,
    name = "Push Day",
    position = 0,
    createdAt = OffsetDateTime.parse("2026-06-01T10:00:00Z"),
    entries = listOf(
        // Stored out of order on purpose: position must win over list order.
        SessionEntry(
            id = 11,
            sessionId = 7,
            position = 1,
            exercises = listOf(
                SessionExercise(
                    id = 22,
                    entryId = 11,
                    exerciseId = 3,
                    position = 0,
                    exercise = exercise(3, "Overhead Press"),
                    sets = listOf(
                        PrescribedSet(id = 31, sessionExerciseId = 22, reps = 10, position = 0),
                    ),
                ),
                // Second exercise in the entry — a superset rotation.
                SessionExercise(
                    id = 23,
                    entryId = 11,
                    exerciseId = 4,
                    position = 1,
                    exercise = exercise(4, "Lateral Raise"),
                    sets = listOf(
                        PrescribedSet(id = 32, sessionExerciseId = 23, reps = 15, position = 0),
                    ),
                ),
            ),
        ),
        SessionEntry(
            id = 10,
            sessionId = 7,
            position = 0,
            exercises = listOf(
                SessionExercise(
                    id = 21,
                    entryId = 10,
                    exerciseId = 2,
                    position = 0,
                    exercise = exercise(2, "Bench Press"),
                    sets = listOf(
                        PrescribedSet(id = 30, sessionExerciseId = 21, reps = 8, position = 0),
                        PrescribedSet(id = 33, sessionExerciseId = 21, reps = null, position = 1),
                    ),
                ),
            ),
        ),
    ),
)

private fun started() = WorkoutDraft.fromSession(session(), "local-1", "2026-06-12T18:00:00Z")

class WorkoutDraftTest {

    @Test
    fun `starting from a session copies the tree in position order`() {
        val draft = started()

        assertEquals("Push Day", draft.name)
        assertEquals(7, draft.sessionId)
        assertEquals(null, draft.serverId)
        assertTrue(draft.dirty)
        assertFalse(draft.completed)
        // Entry at position 0 (Bench) comes first despite list order.
        assertEquals("Bench Press", draft.entries[0].exercises[0].name)
        // Superset keeps its rotation order.
        assertEquals(
            listOf("Overhead Press", "Lateral Raise"),
            draft.entries[1].exercises.map { it.name },
        )
    }

    @Test
    fun `prescribed reps seed the log and stay visible as the target`() {
        val bench = started().entries[0].exercises[0]

        assertEquals(8.0, bench.sets[0].reps)
        assertEquals(8, bench.sets[0].target)
        // An open target stays open: reps to be decided at the rack.
        assertEquals(null, bench.sets[1].reps)
        assertEquals(null, bench.sets[1].target)
        // The load is never prescribed — always starts blank.
        assertTrue(bench.sets.all { it.weight == null })
    }

    @Test
    fun `editing a set marks the draft dirty`() {
        val clean = started().copy(dirty = false)
        val edited = clean.updateSet(0, 0, 0) { it.copy(weight = 80.0) }

        assertTrue(edited.dirty)
        assertEquals(80.0, edited.entries[0].exercises[0].sets[0].weight)
        // Untouched siblings stay untouched.
        assertEquals(null, edited.entries[0].exercises[0].sets[1].weight)
    }

    @Test
    fun `added set seeds from the previous one`() {
        val draft = started()
            .updateSet(0, 0, 0) { it.copy(weight = 82.5) }
            .addSet(0, 0)

        // Seeds from set index 1 (the last), which has no weight…
        assertEquals(3, draft.entries[0].exercises[0].sets.size)
        val added = draft.entries[0].exercises[0].sets[2]
        assertEquals(null, added.weight)

        // …and after removing the open set, a new one seeds from the loaded one.
        val reseeded = draft
            .removeSet(0, 0, 2)
            .removeSet(0, 0, 1)
            .addSet(0, 0)
        val set = reseeded.entries[0].exercises[0].sets[1]
        assertEquals(82.5, set.weight)
        assertEquals(8.0, set.reps)
    }

    @Test
    fun `swapping an exercise keeps the logged sets`() {
        val draft = started()
            .updateSet(0, 0, 0) { it.copy(weight = 60.0) }
            .swapExercise(0, 0, 99, "Dumbbell Press")

        val swapped = draft.entries[0].exercises[0]
        assertEquals(99, swapped.exerciseId)
        assertEquals("Dumbbell Press", swapped.name)
        assertEquals(60.0, swapped.sets[0].weight)
    }

    @Test
    fun `removing the last exercise drops its entry`() {
        val draft = started().removeExercise(0, 0)

        assertEquals(1, draft.entries.size)
        assertEquals("Overhead Press", draft.entries[0].exercises[0].name)
    }

    @Test
    fun `removing one superset exercise keeps the entry`() {
        val draft = started().removeExercise(1, 0)

        assertEquals(2, draft.entries.size)
        assertEquals(listOf("Lateral Raise"), draft.entries[1].exercises.map { it.name })
    }

    @Test
    fun `finish completes and dirties in one move`() {
        val finished = started().copy(dirty = false).finish()

        assertTrue(finished.completed)
        assertTrue(finished.dirty)
    }

    @Test
    fun `a persisted draft round-trips through Moshi, entry ids included`() {
        val adapter = Serializer.moshi.adapter(WorkoutDraft::class.java)
        val draft = started()

        // Data-class equality covers DraftEntry.id, so this proves the ids
        // survive the drafts.json write/read cycle.
        assertEquals(draft, adapter.fromJson(adapter.toJson(draft)))
    }

    @Test
    fun `drafts persisted before entries had ids still deserialize`() {
        val adapter = Serializer.moshi.adapter(WorkoutDraft::class.java)
        val legacy = """
            {"localId":"local-1","sessionId":7,"name":"Push Day",
             "startedAt":"2026-06-12T18:00:00Z","completed":false,"dirty":true,
             "entries":[
               {"exercises":[{"exerciseId":2,"name":"Bench Press",
                 "sets":[{"reps":8,"weight":80.0,"done":true,"target":8}]}]},
               {"exercises":[{"exerciseId":3,"name":"Overhead Press",
                 "sets":[{"done":false}]}]}
             ]}
        """.trimIndent()

        val parsed = assertNotNull(adapter.fromJson(legacy), "an old drafts.json must not be dropped")
        assertEquals(2, parsed.entries.size)
        assertEquals(80.0, parsed.entries[0].exercises[0].sets[0].weight)
        // Missing ids fall back to the constructor default: fresh, distinct.
        assertTrue(parsed.entries.all { it.id.isNotBlank() })
        assertTrue(parsed.entries[0].id != parsed.entries[1].id)
    }

    @Test
    fun `replay payload preserves superset rotation order`() {
        val input = started().toInput()

        assertEquals(2, input.entries.size)
        assertEquals(
            listOf(3, 4),
            input.entries[1].exercises.map { it.exerciseId },
        )
        assertEquals("Push Day", input.name)
        assertEquals(OffsetDateTime.parse("2026-06-12T18:00:00Z"), input.startedAt)
    }

    @Test
    fun `an added set carries the previous effort forward`() {
        val draft = started()
            // Log the bench's last set fully, then carry it forward.
            .updateSet(0, 0, 1) { it.copy(reps = 8.0, weight = 80.0) }
            .addSet(0, 0)
        val added = draft.entries[0].exercises[0].sets.last()
        assertEquals(80.0, added.weight)
        assertEquals(8.0, added.reps)
    }

    @Test
    fun `moving an entry reorders the block as a unit and dirties`() {
        // Reuse one base: fromSession mints fresh entry ids, so two starts differ.
        val base = started().copy(dirty = false)
        val draft = base.moveEntry(0, 1)

        assertEquals("Overhead Press", draft.entries[0].exercises[0].name)
        assertEquals("Bench Press", draft.entries[1].exercises[0].name)
        assertTrue(draft.dirty)
        // Out-of-range is a no-op, dirtiness included.
        assertEquals(base, base.moveEntry(0, 9))
    }

    @Test
    fun `re-dating keeps the original time of day`() {
        val moved = started().withDay(java.time.LocalDate.of(2026, 1, 5))

        assertEquals(
            OffsetDateTime.parse("2026-01-05T18:00:00Z"),
            OffsetDateTime.parse(moved.startedAt),
        )
        assertTrue(moved.dirty)
    }
}
