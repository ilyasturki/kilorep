package dev.kilorep.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.kilorep.api.models.ExerciseInput
import dev.kilorep.api.models.MuscleTarget
import dev.kilorep.app.data.Repo
import dev.kilorep.app.data.userMessage
import dev.kilorep.app.ui.components.GhostButton
import dev.kilorep.app.ui.components.Kicker
import dev.kilorep.app.ui.components.LiftCard
import dev.kilorep.app.ui.components.LiftScreen
import dev.kilorep.app.ui.components.LiftTextField
import dev.kilorep.app.ui.components.PrimaryButton
import dev.kilorep.app.ui.components.Tag
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text
import dev.kilorep.app.ui.watch
import kotlinx.coroutines.launch

private val MUSCLES = listOf(
    "chest", "front delts", "side delts", "rear delts", "triceps", "biceps",
    "forearms", "lats", "traps", "upper back", "lower back", "abs", "obliques",
    "glutes", "quads", "hamstrings", "adductors", "calves",
)

/** Create or edit a catalog exercise: equipment, type, muscles + intensity. */
@Composable
fun ExerciseEditorScreen(
    repo: Repo,
    exerciseId: Int?,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val catalog = repo.exercises.watch()
    val existing = exerciseId?.let { id -> catalog.firstOrNull { it.id == id } }
    val colors = Lift.colors

    var name by remember { mutableStateOf(existing?.name ?: "") }
    var equipment by remember {
        mutableStateOf(existing?.equipment?.value ?: "barbell")
    }
    var type by remember { mutableStateOf(existing?.type?.value ?: "compound") }
    var muscles by remember {
        mutableStateOf<Map<String, String>>(
            existing?.muscles?.associate { it.muscle to it.intensity.value }
                ?: emptyMap(),
        )
    }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    fun cycle(muscle: String) {
        // Tap cycles intensity: none → high → medium → low → none.
        muscles = muscles.toMutableMap().apply {
            when (this[muscle]) {
                null -> put(muscle, "high")
                "high" -> put(muscle, "medium")
                "medium" -> put(muscle, "low")
                else -> remove(muscle)
            }
        }
    }

    LiftScreen(
        title = if (existing == null) "New exercise" else existing.name,
        onBack = onBack,
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            LiftTextField(
                value = name,
                onValueChange = { name = it },
                placeholder = "Exercise name",
                modifier = Modifier.fillMaxWidth(),
            )

            LiftCard(padding = 14.dp) {
                Kicker("Equipment")
                ChoiceRow(
                    options = listOf("barbell", "dumbbell", "machine", "cable", "bodyweight"),
                    selected = equipment,
                    onSelect = { equipment = it },
                )
            }

            LiftCard(padding = 14.dp) {
                Kicker("Type")
                ChoiceRow(
                    options = listOf("compound", "isolation"),
                    selected = type,
                    onSelect = { type = it },
                )
            }

            LiftCard(padding = 14.dp) {
                Kicker("Muscles (tap to cycle intensity)")
                Column(
                    Modifier.padding(top = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    MUSCLES.chunked(3).forEach { row ->
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            row.forEach { muscle ->
                                MuscleChoice(
                                    muscle = muscle,
                                    intensity = muscles[muscle],
                                    onTap = { cycle(muscle) },
                                    modifier = Modifier.weight(1f),
                                )
                            }
                            repeat(3 - row.size) {
                                androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                            }
                        }
                    }
                }
            }

            if (error != null) {
                Text(error ?: "", style = LiftType.secondary, color = colors.danger)
            }

            PrimaryButton(
                if (existing == null) "Create exercise" else "Save changes",
                enabled = name.isNotBlank() && muscles.isNotEmpty() && !busy,
                onClick = {
                    busy = true
                    error = null
                    val input = ExerciseInput(
                        name = name.trim(),
                        equipment = ExerciseInput.Equipment.valueOf(equipment),
                        type = ExerciseInput.Type.valueOf(type),
                        muscles = muscles.map { (muscle, intensity) ->
                            MuscleTarget(
                                muscle = muscle,
                                intensity = MuscleTarget.Intensity.valueOf(intensity),
                            )
                        },
                    )
                    scope.launch {
                        val result =
                            if (existing == null) {
                                repo.createExercise(input)
                            } else {
                                repo.updateExercise(existing.id, input)
                            }
                        result
                            .onSuccess { onBack() }
                            .onFailure { error = it.userMessage() }
                        busy = false
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                height = 52.dp,
            )
            androidx.compose.foundation.layout.Spacer(Modifier.padding(8.dp))
        }
    }
}

@Composable
private fun ChoiceRow(
    options: List<String>,
    selected: String,
    onSelect: (String) -> Unit,
) {
    Column(
        Modifier.padding(top = 8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        options.chunked(3).forEach { row ->
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                row.forEach { option ->
                    val active = option == selected
                    val colors = Lift.colors
                    Text(
                        option.uppercase(),
                        style = LiftType.tag,
                        color = if (active) colors.accentInk else colors.ink2,
                        modifier = Modifier
                            .weight(1f)
                            .background(if (active) colors.accent else colors.surface2)
                            .border(1.dp, if (active) colors.accent else colors.line)
                            .clickable { onSelect(option) }
                            .padding(vertical = 10.dp, horizontal = 8.dp),
                    )
                }
                repeat(3 - row.size) {
                    androidx.compose.foundation.layout.Spacer(Modifier.weight(1f))
                }
            }
        }
    }
}

@Composable
private fun MuscleChoice(
    muscle: String,
    intensity: String?,
    onTap: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = Lift.colors
    val (bg, ink) = when (intensity) {
        "high" -> colors.accent to colors.accentInk
        "medium" -> colors.accentTint to colors.accentText
        "low" -> colors.surface2 to colors.ink
        else -> colors.surface to colors.ink3
    }
    Column(
        modifier
            .background(bg)
            .border(1.dp, if (intensity != null) colors.accent.copy(alpha = 0.4f) else colors.line)
            .clickable(onClick = onTap)
            .padding(vertical = 9.dp, horizontal = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            muscle.uppercase(),
            style = LiftType.tag,
            color = ink,
            maxLines = 1,
        )
        if (intensity != null) {
            Text(intensity.uppercase(), style = LiftType.tag, color = ink)
        }
    }
}
