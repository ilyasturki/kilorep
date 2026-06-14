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
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text

/**
 * Full-screen exercise picker over the cached catalog — searchable by name
 * and alias, like the web's combobox, so "Military Press" finds Overhead
 * Press. Cached data means swapping works in a dead zone.
 */
@Composable
fun ExercisePicker(
    exercises: List<Exercise>,
    title: String,
    onPick: (Exercise) -> Unit,
    onDismiss: () -> Unit,
    excludeIds: Set<Int> = emptySet(),
) {
    var query by remember { mutableStateOf("") }
    val colors = Lift.colors

    FullScreenDialog(title = title, onDismiss = onDismiss) {
        Column(Modifier.fillMaxSize().padding(horizontal = 16.dp)) {
            SearchBox(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                placeholder = "Search exercises",
            )
            val needle = query.trim().lowercase()
            val matches = exercises
                .filter { it.id !in excludeIds }
                .filter { exercise ->
                    needle.isEmpty()
                        || exercise.name.lowercase().contains(needle)
                        || exercise.aliases.any { it.lowercase().contains(needle) }
                }
                .sortedBy { it.name.lowercase() }

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
                items(matches, key = { it.id }) { exercise ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { onPick(exercise) }
                            .padding(vertical = 14.dp, horizontal = 4.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(exercise.name, style = LiftType.rowTitle)
                            val alias = exercise.aliases.firstOrNull {
                                needle.isNotEmpty() && it.lowercase().contains(needle)
                            }
                            if (alias != null) {
                                Text(
                                    "($alias)",
                                    style = LiftType.secondary,
                                    color = colors.ink3,
                                )
                            }
                        }
                        Tag(exercise.equipment.value)
                    }
                }
            }
        }
    }
}
