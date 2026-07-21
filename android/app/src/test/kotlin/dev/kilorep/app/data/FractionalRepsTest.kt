package dev.kilorep.app.data

import com.squareup.moshi.Types
import dev.kilorep.api.infrastructure.Serializer
import dev.kilorep.api.models.WorkoutWithEntries
import dev.kilorep.app.ui.formatReps
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * A fractional logged rep (a half-rep) once blanked the whole history: reps
 * were typed as integers, so a single 6.5 in the /api/workouts response failed
 * Moshi deserialization for the entire list. Reps are a number end to end now —
 * this guards the contract from regressing back to integer.
 */
class FractionalRepsTest {
    @Test
    fun `a workout tree with a half-rep deserializes`() {
        val json = """
            [{"id":1,"userId":1,"sessionId":null,"name":"push a",
              "startedAt":"2026-06-25T14:20:16.000Z","completed":true,
              "entries":[{"id":1,"workoutId":1,"position":0,
                "exercises":[{"id":1,"entryId":1,"exerciseId":2,"position":0,
                  "exercise":{"id":2,"userId":1,"name":"Incline Barbell Bench Press",
                    "equipment":"barbell","type":"compound","loadMode":"total","muscles":[],"aliases":[]},
                  "sets":[{"id":1,"workoutExerciseId":1,"reps":6.5,"weight":50.0,"position":0}]}]}]}]
        """.trimIndent()
        val adapter = Serializer.moshi.adapter<List<WorkoutWithEntries>>(
            Types.newParameterizedType(List::class.java, WorkoutWithEntries::class.java),
        )
        val workouts = adapter.fromJson(json)!!
        assertEquals(6.5, workouts.single().entries.single().exercises.single().sets.single().reps)
    }

    @Test
    fun `formatReps drops the trailing zero on whole reps but keeps a half`() {
        assertEquals("6", formatReps(6.0))
        assertEquals("6.5", formatReps(6.5))
        assertEquals("?", formatReps(null))
    }
}
