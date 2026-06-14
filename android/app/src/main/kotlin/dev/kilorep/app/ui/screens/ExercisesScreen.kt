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
import dev.kilorep.app.data.Repo
import dev.kilorep.app.ui.components.EmptyState
import dev.kilorep.app.ui.components.LiftIconButton
import dev.kilorep.app.ui.components.LiftScreen
import dev.kilorep.app.ui.components.SearchBox
import dev.kilorep.app.ui.components.Tag
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
            val needle = query.trim().lowercase()
            val matches = exercises
                .filter {
                    needle.isEmpty()
                        || it.name.lowercase().contains(needle)
                        || it.aliases.any { alias -> alias.lowercase().contains(needle) }
                }
                .sortedBy { it.name.lowercase() }

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
                items(matches, key = { it.id }) { exercise ->
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable { onOpen(exercise.id) }
                            .padding(vertical = 13.dp, horizontal = 4.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(exercise.name, style = LiftType.rowTitle)
                            val alias = exercise.aliases.firstOrNull {
                                needle.isNotEmpty() && it.lowercase().contains(needle)
                            }
                            Text(
                                alias?.let { "($it)" }
                                    ?: exercise.muscles.joinToString(", ") { it.muscle },
                                style = LiftType.secondary,
                                color = colors.ink3,
                                maxLines = 1,
                            )
                        }
                        Tag(exercise.equipment.value)
                        Tag(exercise.type.value)
                    }
                }
            }
        }
    }
}
