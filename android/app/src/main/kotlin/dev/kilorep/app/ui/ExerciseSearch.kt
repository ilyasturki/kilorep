package dev.kilorep.app.ui

import dev.kilorep.api.models.Exercise

data class ExerciseHit(val exercise: Exercise, val match: FuzzyMatch)

/**
 * The one search contract for every exercise list: fuzzy over name + aliases,
 * ranked by score with an A→Z tiebreak — which is the entire order when the
 * query is empty, since everything scores zero then.
 */
fun searchExercises(exercises: List<Exercise>, query: String): List<ExerciseHit> {
    val tokens = fuzzyTokens(query)
    return exercises
        .mapNotNull { exercise ->
            fuzzyMatch(exercise.name, exercise.aliases, tokens)
                ?.let { ExerciseHit(exercise, it) }
        }
        .sortedWith(
            compareByDescending<ExerciseHit> { it.match.score }
                .thenBy(String.CASE_INSENSITIVE_ORDER) { it.exercise.name },
        )
}
