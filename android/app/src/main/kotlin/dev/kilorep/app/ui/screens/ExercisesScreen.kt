package dev.kilorep.app.ui.screens

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
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.kilorep.api.models.Exercise
import dev.kilorep.app.data.Repo
import dev.kilorep.app.ui.FuzzyMatch
import dev.kilorep.app.ui.components.EmptyState
import dev.kilorep.app.ui.components.HighlightedText
import dev.kilorep.app.ui.components.LiftIconButton
import dev.kilorep.app.ui.components.LiftScreen
import dev.kilorep.app.ui.components.SearchBox
import dev.kilorep.app.ui.components.Tag
import dev.kilorep.app.ui.fuzzyMatch
import dev.kilorep.app.ui.fuzzyTokens
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text
import dev.kilorep.app.ui.watch

/** The catalog: searched by name and alias, like the web combobox. */
@Composable
fun ExercisesScreen(
    repo: Repo,
    offline: Boolean,
    onOpen: (Int) -> Unit,
    onCreate: () -> Unit,
) {
    val exercises = repo.exercises.watch()
    var query by remember { mutableStateOf("") }
    val colors = Lift.colors

    // Keyed on offline so coming online mid-screen still refreshes.
    LaunchedEffect(offline) {
        if (!offline) repo.refreshExercises()
    }

    LiftScreen(
        title = "Exercises",
        offline = offline,
        actions = {
            LiftIconButton(LiftIcons.Plus, onClick = onCreate)
        },
    ) {
        Column(Modifier.fillMaxSize().padding(horizontal = 14.dp)) {
            SearchBox(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = "Search name or alias",
            )
            // Fuzzy like the web: score-ranked while typing, A→Z when empty
            // (every exercise scores 0 then, so the name tiebreak decides).
            val matches = remember(exercises, query) {
                val tokens = fuzzyTokens(query)
                exercises
                    .mapNotNull { exercise ->
                        fuzzyMatch(exercise.name, exercise.aliases, tokens)
                            ?.let { exercise to it }
                    }
                    .sortedWith(
                        compareByDescending<Pair<Exercise, FuzzyMatch>> { it.second.score }
                            .thenBy { it.first.name.lowercase() },
                    )
            }

            if (matches.isEmpty()) {
                EmptyState(
                    title = if (exercises.isEmpty()) "Catalog is empty" else "No match",
                    modifier = Modifier.padding(top = 14.dp),
                )
            }
            LazyColumn(
                Modifier.weight(1f).padding(top = 12.dp),
                verticalArrangement = Arrangement.spacedBy(1.dp),
            ) {
                items(matches, key = { it.first.id }) { (exercise, match) ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { onOpen(exercise.id) }
                            .padding(vertical = 13.dp, horizontal = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            HighlightedText(
                                exercise.name,
                                match.labelPositions,
                                style = LiftType.rowTitle,
                            )
                            if (match.matchedKeyword != null) {
                                HighlightedText(
                                    "(${match.matchedKeyword})",
                                    match.keywordPositions.map { it + 1 },
                                    style = LiftType.secondary,
                                    color = colors.ink3,
                                    maxLines = 1,
                                )
                            } else {
                                Text(
                                    exercise.muscles.joinToString(", ") { it.muscle },
                                    style = LiftType.secondary,
                                    color = colors.ink3,
                                    maxLines = 1,
                                )
                            }
                        }
                        Tag(exercise.equipment.value)
                        Tag(exercise.type.value)
                    }
                }
            }
        }
    }
}
