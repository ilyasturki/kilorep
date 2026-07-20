package dev.kilorep.app.ui

import dev.kilorep.api.models.Exercise
import dev.kilorep.api.models.MuscleTarget
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private fun exercise(
    id: Int,
    name: String,
    type: Exercise.Type = Exercise.Type.compound,
    equipment: Exercise.Equipment = Exercise.Equipment.barbell,
    vararg muscles: Pair<String, MuscleTarget.Intensity>,
) = Exercise(
    id = id,
    userId = 1,
    name = name,
    equipment = equipment,
    type = type,
    muscles = muscles.map { MuscleTarget(it.first, it.second) },
    aliases = emptyList(),
)

class SimilarityTest {

    private val high = MuscleTarget.Intensity.high
    private val low = MuscleTarget.Intensity.low

    @Test
    fun identicalProfileRanksAbovePartialOverlap() {
        val bench = exercise(1, "Bench Press", muscles = arrayOf("chest" to high, "triceps" to low))
        val dbPress = exercise(2, "Dumbbell Press", muscles = arrayOf("chest" to high, "triceps" to low))
        val dips = exercise(3, "Dips", muscles = arrayOf("triceps" to high, "chest" to low))
        assertTrue(exerciseSimilarity(bench, dbPress) > exerciseSimilarity(bench, dips))
    }

    @Test
    fun intensityWeightingPrefersMatchingPrimeMovers() {
        val bench = exercise(1, "Bench Press", muscles = arrayOf("chest" to high, "triceps" to low))
        val fly = exercise(2, "Chest Fly", muscles = arrayOf("chest" to high))
        val pushdown = exercise(3, "Pushdown", muscles = arrayOf("triceps" to high))
        assertTrue(exerciseSimilarity(bench, fly) > exerciseSimilarity(bench, pushdown))
    }

    @Test
    fun noSharedMusclesScoresZeroEvenWithSameType() {
        val bench = exercise(1, "Bench Press", muscles = arrayOf("chest" to high))
        val squat = exercise(2, "Squat", muscles = arrayOf("quads" to high))
        assertEquals(0.0, exerciseSimilarity(bench, squat), absoluteTolerance = 0.0)
    }

    @Test
    fun sameTypeBreaksTiesAmongOverlappingCandidates() {
        val curl = exercise(1, "Curl", Exercise.Type.isolation, muscles = arrayOf("biceps" to high))
        val hammer = exercise(2, "Hammer Curl", Exercise.Type.isolation, muscles = arrayOf("biceps" to high))
        val chinUp = exercise(3, "Chin-up", Exercise.Type.compound, muscles = arrayOf("biceps" to high))
        assertTrue(exerciseSimilarity(curl, hammer) > exerciseSimilarity(curl, chinUp))
    }

    @Test
    fun equipmentDoesNotAffectTheScore() {
        val barbell = exercise(1, "Bench Press", muscles = arrayOf("chest" to high))
        val machine = exercise(
            2, "Chest Press", Exercise.Type.compound, Exercise.Equipment.machine,
            "chest" to high,
        )
        val alsoBarbell = exercise(3, "Close-grip Bench", muscles = arrayOf("chest" to high))
        assertEquals(
            exerciseSimilarity(barbell, machine),
            exerciseSimilarity(barbell, alsoBarbell),
            absoluteTolerance = 1e-9,
        )
    }

    @Test
    fun topMuscleIsTheHighestIntensityTarget() {
        val bench = exercise(1, "Bench Press", muscles = arrayOf("triceps" to low, "chest" to high))
        assertEquals("chest", topMuscle(bench))
    }
}
