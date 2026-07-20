package dev.kilorep.app.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.kilorep.api.models.Exercise
import dev.kilorep.app.ui.exerciseSimilarity
import dev.kilorep.app.ui.fuzzyTokens
import dev.kilorep.app.ui.searchExercises
import dev.kilorep.app.ui.topMuscle

/**
 * Full-screen exercise picker over the cached catalog — fuzzy-searched by
 * name and alias with the web's matcher, so "Military Press" and "bp" both
 * find what they should. Cached data means swapping works in a dead zone.
 */
@Composable
fun ExercisePicker(
    exercises: List<Exercise>,
    title: String,
    onPick: (Exercise) -> Unit,
    onDismiss: () -> Unit,
    excludeIds: Set<Int> = emptySet(),
    /**
     * Swap context: until a query is typed, candidates are ordered by
     * muscle-profile similarity to this exercise, likeliest stand-in first.
     */
    similarTo: Exercise? = null,
) {
    var query by remember { mutableStateOf("") }

    FullScreenDialog(title = title, onDismiss = onDismiss) {
        Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
            SearchBox(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = "Search exercises",
            )
            val matches = remember(exercises, query, excludeIds, similarTo) {
                val hits = searchExercises(
                    exercises.filter { it.id !in excludeIds && it.id != similarTo?.id },
                    query,
                )
                if (similarTo != null && fuzzyTokens(query).isEmpty()) {
                    val similarity = hits.associate {
                        it.exercise.id to exerciseSimilarity(similarTo, it.exercise)
                    }
                    // The sort is stable, so equal similarity keeps the A→Z order.
                    hits.sortedByDescending { similarity.getValue(it.exercise.id) }
                } else {
                    hits
                }
            }

            if (matches.isEmpty()) {
                EmptyState(
                    title = if (exercises.isEmpty()) "No exercises cached yet" else "No match",
                    hint = if (exercises.isEmpty()) "Connect once to load your catalog" else null,
                    modifier = Modifier.padding(top = 16.dp),
                )
            }
            LazyColumn(
                verticalArrangement = Arrangement.spacedBy(1.dp),
                modifier = Modifier.weight(1f).padding(top = 12.dp),
            ) {
                items(matches, key = { it.exercise.id }) { (exercise, match) ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { onPick(exercise) }
                            .padding(vertical = 14.dp, horizontal = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        MatchedLabel(
                            name = exercise.name,
                            match = match,
                            fallback = topMuscle(exercise),
                            modifier = Modifier.weight(1f),
                        )
                        Tag(exercise.equipment.value)
                    }
                }
            }
        }
    }
}
