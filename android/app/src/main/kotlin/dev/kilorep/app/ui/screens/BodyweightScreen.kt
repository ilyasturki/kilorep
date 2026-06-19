package dev.kilorep.app.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import dev.kilorep.api.models.Bodyweight
import dev.kilorep.api.models.BodyweightInput
import dev.kilorep.app.data.Repo
import dev.kilorep.app.ui.components.ConfirmDialog
import dev.kilorep.app.ui.components.EmptyState
import dev.kilorep.app.ui.components.GhostButton
import dev.kilorep.app.ui.components.Kicker
import dev.kilorep.app.ui.components.LiftCard
import dev.kilorep.app.ui.components.LiftDialogCard
import dev.kilorep.app.ui.components.LiftIconButton
import dev.kilorep.app.ui.components.LiftScreen
import dev.kilorep.app.ui.components.PrimaryButton
import dev.kilorep.app.ui.components.SegmentedToggle
import dev.kilorep.app.ui.components.StatCell
import dev.kilorep.app.ui.components.StepperField
import dev.kilorep.app.ui.formatDate
import dev.kilorep.app.ui.formatFixed2
import dev.kilorep.app.ui.formatSigned
import dev.kilorep.app.ui.formatWeight
import dev.kilorep.app.ui.parseWeight
import dev.kilorep.app.ui.roundWeight
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text
import dev.kilorep.app.ui.watch
import java.time.LocalDate
import kotlinx.coroutines.launch

private val RANGES = listOf("1W", "1M", "3M", "1Y", "All")

/**
 * Bodyweight (web's /weight): a stats bar (current, range change, low, high),
 * a range-toggled trend, and the editable weigh-in log. One weigh-in per
 * calendar day; logging the same day overwrites.
 */
@Composable
fun BodyweightScreen(repo: Repo, offline: Boolean, onBack: (() -> Unit)?) {
    val entries = repo.bodyweight.watch()
    val scope = rememberCoroutineScope()
    val colors = Lift.colors
    val today = LocalDate.now()

    var range by remember { mutableStateOf("All") }
    var form by remember { mutableStateOf<BodyweightDraft?>(null) }
    var confirmDelete by remember { mutableStateOf<Bodyweight?>(null) }

    LaunchedEffect(offline) {
        if (!offline) repo.refreshBodyweight()
    }

    val sorted = remember(entries) { entries.sortedBy { it.date } }
    val latest = sorted.lastOrNull()
    val cutoff: LocalDate? = when (range) {
        "1W" -> today.minusWeeks(1)
        "1M" -> today.minusMonths(1)
        "3M" -> today.minusMonths(3)
        "1Y" -> today.minusYears(1)
        else -> null
    }
    val ranged = if (cutoff == null) sorted else sorted.filter { !it.date.isBefore(cutoff) }
    val change = if (ranged.size >= 2) {
        (ranged.last().weight - ranged.first().weight)
    } else {
        null
    }
    val low = ranged.minOfOrNull { it.weight }
    val high = ranged.maxOfOrNull { it.weight }
    // Newest-first log, each row's delta against the next-older weigh-in.
    val descending = remember(entries) { entries.sortedByDescending { it.date } }

    LiftScreen(title = "Bodyweight", onBack = onBack, offline = offline) {
        LazyColumn(
            Modifier.fillMaxSize().padding(horizontal = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                PrimaryButton(
                    "Log weight",
                    onClick = {
                        form = BodyweightDraft(
                            id = null,
                            date = today,
                            weight = latest?.weight ?: 75.0,
                        )
                    },
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                    icon = LiftIcons.Plus,
                )
            }

            if (latest != null) {
                item {
                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        StatCell(formatFixed2(latest.weight), "Current · kg", Modifier.weight(1f))
                        StatCell(
                            change?.let(::formatSigned) ?: "—",
                            "Change · $range",
                            Modifier.weight(1f),
                        )
                    }
                }
                if (low != null && high != null) {
                    item {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            StatCell(formatFixed2(low), "Lowest · kg", Modifier.weight(1f))
                            StatCell(formatFixed2(high), "Highest · kg", Modifier.weight(1f))
                        }
                    }
                }
            }

            if (sorted.size >= 2) {
                item {
                    LiftCard(padding = 14.dp) {
                        Row(
                            Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Kicker("Progression")
                            SegmentedToggle(RANGES, range, onSelect = { range = it })
                        }
                        if (ranged.size >= 2) {
                            TrendChart(
                                entries = ranged,
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(140.dp)
                                    .padding(top = 12.dp),
                            )
                        } else {
                            Text(
                                "No weigh-ins in this range.",
                                style = LiftType.secondary,
                                color = colors.ink3,
                                modifier = Modifier.padding(top = 12.dp),
                            )
                        }
                    }
                }
            }

            item { Kicker("Weigh-ins") }
            if (entries.isEmpty()) {
                item { EmptyState(title = "No weigh-ins yet", hint = "Log your first to start tracking.") }
            }
            itemsIndexed(descending, key = { _, it -> it.id }) { index, entry ->
                val older = descending.getOrNull(index + 1)
                val delta = older?.let { entry.weight - it.weight }
                LiftCard(padding = 12.dp) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            formatDate(entry.date),
                            style = LiftType.mono,
                            color = colors.ink2,
                            modifier = Modifier.weight(1f),
                        )
                        Text("${formatWeight(entry.weight)} kg", style = LiftType.rowTitle)
                        Text(
                            delta?.let(::formatSigned) ?: "",
                            style = LiftType.mono,
                            color = colors.ink3,
                        )
                        LiftIconButton(
                            LiftIcons.Pencil,
                            onClick = {
                                form = BodyweightDraft(entry.id, entry.date, entry.weight)
                            },
                            size = 34.dp,
                            iconSize = 15.dp,
                        )
                        LiftIconButton(
                            LiftIcons.Trash,
                            onClick = { confirmDelete = entry },
                            size = 34.dp,
                            iconSize = 15.dp,
                            danger = true,
                        )
                    }
                }
            }
        }
    }

    form?.let { draft ->
        BodyweightForm(
            draft = draft,
            today = today,
            onSave = { date, weight ->
                scope.launch {
                    val input = BodyweightInput(date, weight)
                    val result = if (draft.id != null) {
                        repo.updateBodyweight(draft.id, input)
                    } else {
                        repo.logBodyweight(input)
                    }
                    result.onSuccess { form = null }
                }
            },
            onDismiss = { form = null },
        )
    }

    confirmDelete?.let { entry ->
        ConfirmDialog(
            title = "Delete the ${formatDate(entry.date)} weigh-in?",
            body = null,
            confirmLabel = "Delete",
            danger = true,
            onConfirm = {
                scope.launch { repo.deleteBodyweight(entry.id) }
                confirmDelete = null
            },
            onDismiss = { confirmDelete = null },
        )
    }
}

private data class BodyweightDraft(val id: Int?, val date: LocalDate, val weight: Double)

@Composable
private fun BodyweightForm(
    draft: BodyweightDraft,
    today: LocalDate,
    onSave: (LocalDate, Double) -> Unit,
    onDismiss: () -> Unit,
) {
    var day by remember { mutableStateOf(draft.date) }
    var weightText by remember { mutableStateOf(formatWeight(draft.weight)) }
    var error by remember { mutableStateOf<String?>(null) }
    val colors = Lift.colors
    fun clamp(d: LocalDate) = if (d.isAfter(today)) today else d

    LiftDialogCard(onDismiss = onDismiss) {
        Text(if (draft.id != null) "Edit weigh-in" else "Log weight", style = LiftType.rowTitle)

        Kicker("Date")
        Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            LiftIconButton(
                LiftIcons.Minus,
                onClick = { day = day.minusDays(1) },
                size = 40.dp,
            )
            Text(
                formatDate(day),
                style = LiftType.mono,
                modifier = Modifier.weight(1f),
            )
            LiftIconButton(
                LiftIcons.Plus,
                onClick = { day = clamp(day.plusDays(1)) },
                size = 40.dp,
                enabled = day.isBefore(today),
            )
        }

        Kicker("Weight")
        StepperField(
            value = weightText,
            onValueChange = { weightText = it },
            onStep = { delta ->
                val current = parseWeight(weightText) ?: draft.weight
                weightText = formatWeight(roundWeight(current + delta * 0.1))
            },
            suffix = "KG",
            decimal = true,
            modifier = Modifier.fillMaxWidth(),
        )

        if (error != null) {
            Text(error ?: "", style = LiftType.secondary, color = colors.danger)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            GhostButton("Cancel", onDismiss, Modifier.weight(1f))
            PrimaryButton(
                if (draft.id != null) "Save" else "Log",
                onClick = {
                    val weight = parseWeight(weightText)
                    when {
                        weight == null -> error = "Enter a weight"
                        weight < 20 || weight > 400 -> error = "Weight must be 20–400 kg"
                        else -> onSave(day, weight)
                    }
                },
                modifier = Modifier.weight(1f),
            )
        }
    }
}

/** Minimal polyline of the ranged weigh-ins — the web chart's silhouette. */
@Composable
private fun TrendChart(entries: List<Bodyweight>, modifier: Modifier = Modifier) {
    val colors = Lift.colors
    val points = entries.sortedBy { it.date }.takeLast(90)
    val min = points.minOf { it.weight }
    val max = points.maxOf { it.weight }
    val span = (max - min).coerceAtLeast(0.5)

    Column(modifier) {
        Canvas(Modifier.fillMaxWidth().weight(1f)) {
            val stepX = if (points.size == 1) 0f else size.width / (points.size - 1)
            val path = Path()
            points.forEachIndexed { i, entry ->
                val x = i * stepX
                val y = size.height * (1f - ((entry.weight - min) / span).toFloat() * 0.9f - 0.05f)
                if (i == 0) path.moveTo(x, y) else path.lineTo(x, y)
            }
            drawPath(path, colors.accent, style = Stroke(width = 4f))
            points.lastOrNull()?.let { last ->
                val y = size.height *
                    (1f - ((last.weight - min) / span).toFloat() * 0.9f - 0.05f)
                drawCircle(colors.accent, radius = 8f, center = Offset(size.width, y))
            }
        }
        Row(
            Modifier.fillMaxWidth().padding(top = 6.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("${formatWeight(min)} kg", style = LiftType.tag, color = colors.ink3)
            Text("${formatWeight(max)} kg", style = LiftType.tag, color = colors.ink3)
        }
    }
}
