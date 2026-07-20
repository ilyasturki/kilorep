package dev.kilorep.app.ui

import dev.kilorep.api.models.Exercise
import dev.kilorep.api.models.MuscleTarget

private fun weightOf(intensity: MuscleTarget.Intensity): Double = when (intensity) {
    MuscleTarget.Intensity.high -> 3.0
    MuscleTarget.Intensity.medium -> 2.0
    MuscleTarget.Intensity.low -> 1.0
}

private const val TYPE_BONUS = 0.1

/**
 * How close a swap candidate is to the exercise being replaced: weighted
 * Jaccard overlap of the muscle profiles (intensity 3/2/1), plus a small
 * bump for matching compound/isolation. Equipment deliberately doesn't
 * count — the usual reason to swap is that the equipment is taken, so an
 * equivalent movement on different gear is exactly what's wanted.
 */
fun exerciseSimilarity(a: Exercise, b: Exercise): Double {
    val wa = a.muscles.associate { it.muscle to weightOf(it.intensity) }
    val wb = b.muscles.associate { it.muscle to weightOf(it.intensity) }
    var shared = 0.0
    var union = 0.0
    for (muscle in wa.keys + wb.keys) {
        val x = wa[muscle] ?: 0.0
        val y = wb[muscle] ?: 0.0
        shared += minOf(x, y)
        union += maxOf(x, y)
    }
    // Same type alone doesn't make two movements similar; the bonus only
    // breaks ties between candidates that already share muscles.
    if (shared == 0.0) return 0.0
    return shared / union + if (a.type == b.type) TYPE_BONUS else 0.0
}

/** The prime mover — what the web's swap rows badge each candidate with. */
fun topMuscle(exercise: Exercise): String? =
    exercise.muscles.maxByOrNull { weightOf(it.intensity) }?.muscle
