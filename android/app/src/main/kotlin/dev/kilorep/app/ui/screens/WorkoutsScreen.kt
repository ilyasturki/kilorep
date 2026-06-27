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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.kilorep.api.models.MuscleTarget
import dev.kilorep.api.models.WorkoutWithEntries
import dev.kilorep.app.data.Repo
import dev.kilorep.app.store.DashboardStats
import dev.kilorep.app.store.WorkoutDraft
import dev.kilorep.app.ui.components.ConfirmDialog
import dev.kilorep.app.ui.components.EmptyState
import dev.kilorep.app.ui.components.GhostButton
import dev.kilorep.app.ui.components.Kicker
import dev.kilorep.app.ui.components.LiftCard
import dev.kilorep.app.ui.components.LiftIconButton
import dev.kilorep.app.ui.components.LiftScreen
import dev.kilorep.app.ui.components.PrimaryButton
import dev.kilorep.app.ui.components.Tag
import dev.kilorep.app.ui.components.TopMuscles
import dev.kilorep.app.ui.formatDay
import dev.kilorep.app.ui.formatVolume
import dev.kilorep.app.ui.formatWeight
import dev.kilorep.app.ui.plural
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text
import dev.kilorep.app.ui.watch
import kotlin.math.roundToLong
import kotlinx.coroutines.launch

/**
 * The Workouts list (web's /workouts): in-progress pinned first, then the
 * finished history, each card a glance at what was trained — muscles, totals,
 * and the numbered exercise readout — with a Start/Continue CTA in the header.
 * Serves the cache instantly and refreshes when online.
 */
@Composable
fun WorkoutsScreen(
    repo: Repo,
    offline: Boolean,
    onOpenDraft: (String) -> Unit,
    onOpenServerWorkout: (Int) -> Unit,
) {
    val drafts = repo.drafts.watch()
    val workouts = repo.workouts.watch()
    val catalog = repo.exercises.watch()
    val scope = rememberCoroutineScope()
    var confirmDelete by remember { mutableStateOf<Glance?>(null) }

    val muscleById = remember(catalog) { catalog.associate { it.id to it.muscles } }

    // Keyed on offline so coming online mid-screen still refreshes.
    LaunchedEffect(offline) {
        if (!offline) repo.refreshAll()
    }

    // In-progress first (local drafts, then any started elsewhere), then the
    // finished history. A draft already stands in for its server row, so drop
    // that row to avoid showing the same workout twice. The aggregation is
    // rebuilt only when the cache changes; each card binds its tap/delete
    // handlers at render time from the glance's source.
    val ordered: List<Glance> = remember(drafts, workouts, muscleById) {
        val draftServerIds = drafts.mapNotNull { it.serverId }.toSet()
        val (activeServer, doneServer) = workouts
            .filter { it.id !in draftServerIds }
            .partition { !it.completed }
        buildList {
            drafts.filter { !it.completed }.forEach { add(glanceOfDraft(it, muscleById)) }
            activeServer.forEach { add(glanceOfServer(it, muscleById)) }
            doneServer.forEach { add(glanceOfServer(it, muscleById)) }
        }
    }

    LiftScreen(title = "Workouts", offline = offline) {
        Column(Modifier.fillMaxSize()) {
            WorkoutStartButton(
                repo = repo,
                onOpen = onOpenDraft,
                modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 10.dp),
            )
            if (ordered.isEmpty()) {
                EmptyState(
                    title = "No workouts yet",
                    hint = "Start one from a session to begin tracking.",
                    modifier = Modifier.padding(14.dp),
                )
                return@Column
            }
            LazyColumn(
                Modifier.fillMaxSize().padding(horizontal = 14.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                items(ordered, key = { it.key }) { glance ->
                    WorkoutCard(
                        glance,
                        onOpen = {
                            when (val s = glance.source) {
                                is GlanceSource.Draft -> onOpenDraft(s.localId)
                                is GlanceSource.Server -> onOpenServerWorkout(s.id)
                            }
                        },
                        onDelete = { confirmDelete = glance },
                    )
                }
            }
        }
    }

    confirmDelete?.let { glance ->
        ConfirmDialog(
            title = "Delete “${glance.name}”?",
            body = "Its logged sets are gone for good.",
            confirmLabel = "Delete",
            danger = true,
            onConfirm = {
                when (val s = glance.source) {
                    is GlanceSource.Draft -> {
                        s.serverId?.let { scope.launch { repo.deleteWorkout(it) } }
                        repo.discardDraft(s.localId)
                    }
                    is GlanceSource.Server -> scope.launch { repo.deleteWorkout(s.id) }
                }
                confirmDelete = null
            },
            onDismiss = { confirmDelete = null },
        )
    }
}

@Composable
private fun WorkoutCard(g: Glance, onOpen: () -> Unit, onDelete: () -> Unit) {
    val colors = Lift.colors
    LiftCard(padding = 14.dp) {
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                g.name,
                style = LiftType.rowTitle,
                modifier = Modifier.weight(1f).clickable(onClick = onOpen),
                maxLines = 1,
            )
            Tag(if (g.inProgress) "In progress" else g.dayLabel, accent = g.inProgress)
            LiftIconButton(
                LiftIcons.Trash,
                onClick = onDelete,
                size = 36.dp,
                iconSize = 16.dp,
                danger = true,
            )
        }
        TopMuscles(g.muscles, Modifier.padding(top = 10.dp))
        Text(
            listOf(
                plural(g.exercises, "exercise"),
                plural(g.sets, "set"),
                "${formatVolume(g.volume)} kg",
            ).joinToString("  ·  "),
            style = LiftType.secondary,
            color = colors.ink2,
            modifier = Modifier.padding(top = 8.dp),
        )
        g.blocks.forEach { block ->
            Column(Modifier.padding(top = 8.dp)) {
                if (block.isSuperset) {
                    Kicker("Superset", accent = true, modifier = Modifier.padding(bottom = 4.dp))
                }
                block.exercises.forEach { ex ->
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 2.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("%02d".format(ex.n), style = LiftType.mono, color = colors.ink3)
                        Text(
                            ex.name,
                            style = LiftType.secondary,
                            modifier = Modifier.weight(1f),
                            maxLines = 1,
                        )
                        Text(exSummary(ex), style = LiftType.mono, color = colors.ink2)
                    }
                }
            }
        }
        if (g.inProgress) {
            PrimaryButton(
                "Resume",
                onClick = onOpen,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                icon = LiftIcons.Play,
            )
        } else {
            GhostButton(
                "Review",
                onClick = onOpen,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
                icon = LiftIcons.ChevronRight,
            )
        }
    }
}

// ── Glance model + builders (mirror web's workoutStats + topMuscles) ─────────

private class GlanceEx(
    val exerciseId: Int,
    val name: String,
    val setCount: Int,
    val top: Double?,
    val n: Int,
)

private class GlanceBlock(val isSuperset: Boolean, val exercises: List<GlanceEx>)

private sealed interface GlanceSource {
    data class Draft(val localId: String, val serverId: Int?) : GlanceSource
    data class Server(val id: Int) : GlanceSource
}

private class Glance(
    val key: String,
    val source: GlanceSource,
    val name: String,
    val inProgress: Boolean,
    val dayLabel: String,
    val exercises: Int,
    val sets: Int,
    val volume: Long,
    val blocks: List<GlanceBlock>,
    val muscles: List<String>,
)

private fun exSummary(ex: GlanceEx): String =
    if (ex.top != null) "${plural(ex.setCount, "set")} · ${formatWeight(ex.top)} kg" else plural(ex.setCount, "set")

private fun topMuscles(
    exercises: List<Pair<Int, Int>>,
    muscleById: Map<Int, List<MuscleTarget>>,
    limit: Int = 3,
): List<String> = DashboardStats.topMuscles(
    exercises.map { (exerciseId, setCount) -> (muscleById[exerciseId] ?: emptyList()) to setCount },
    limit,
)

private fun glanceOfServer(
    w: WorkoutWithEntries,
    muscleById: Map<Int, List<MuscleTarget>>,
): Glance {
    var n = 0
    var exercises = 0
    var sets = 0
    var volume = 0.0
    val forMuscles = mutableListOf<Pair<Int, Int>>()
    val blocks = w.entries.map { entry ->
        GlanceBlock(
            isSuperset = entry.exercises.size > 1,
            exercises = entry.exercises.map { ex ->
                exercises++
                sets += ex.sets.size
                volume += ex.sets.sumOf { (it.weight ?: 0.0) * (it.reps ?: 0.0) }
                forMuscles += ex.exerciseId to ex.sets.size
                GlanceEx(ex.exerciseId, ex.exercise.name, ex.sets.size, ex.sets.mapNotNull { it.weight }.maxOrNull(), ++n)
            },
        )
    }
    return Glance(
        key = "w${w.id}",
        source = GlanceSource.Server(w.id),
        name = w.name,
        inProgress = !w.completed,
        dayLabel = formatDay(w.startedAt),
        exercises = exercises,
        sets = sets,
        volume = volume.roundToLong(),
        blocks = blocks,
        muscles = topMuscles(forMuscles, muscleById),
    )
}

private fun glanceOfDraft(
    draft: WorkoutDraft,
    muscleById: Map<Int, List<MuscleTarget>>,
): Glance {
    var n = 0
    var exercises = 0
    var sets = 0
    var volume = 0.0
    val forMuscles = mutableListOf<Pair<Int, Int>>()
    val blocks = draft.entries.map { entry ->
        GlanceBlock(
            isSuperset = entry.exercises.size > 1,
            exercises = entry.exercises.map { ex ->
                exercises++
                sets += ex.sets.size
                volume += ex.sets.sumOf { (it.weight ?: 0.0) * (it.reps ?: 0.0) }
                forMuscles += ex.exerciseId to ex.sets.size
                GlanceEx(ex.exerciseId, ex.name, ex.sets.size, ex.sets.mapNotNull { it.weight }.maxOrNull(), ++n)
            },
        )
    }
    return Glance(
        key = "d${draft.localId}",
        source = GlanceSource.Draft(draft.localId, draft.serverId),
        name = draft.name,
        inProgress = !draft.completed,
        dayLabel = formatDay(draft.startedAt),
        exercises = exercises,
        sets = sets,
        volume = volume.roundToLong(),
        blocks = blocks,
        muscles = topMuscles(forMuscles, muscleById),
    )
}
