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
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.dp
import dev.kilorep.api.models.Bodyweight
import dev.kilorep.api.models.BodyweightInput
import dev.kilorep.app.data.Repo
import dev.kilorep.app.data.userMessage
import dev.kilorep.app.ui.components.ConfirmDialog
import dev.kilorep.app.ui.components.EmptyState
import dev.kilorep.app.ui.components.Kicker
import dev.kilorep.app.ui.components.LiftCard
import dev.kilorep.app.ui.components.LiftIconButton
import dev.kilorep.app.ui.components.LiftScreen
import dev.kilorep.app.ui.components.PrimaryButton
import dev.kilorep.app.ui.components.StepperField
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

/**
 * Bodyweight: one weigh-in per calendar day (re-logging overwrites), with
 * the trend drawn from the same data the web charts.
 */
@Composable
fun BodyweightScreen(repo: Repo, offline: Boolean, onBack: (() -> Unit)?) {
    val entries = repo.bodyweight.watch()
    val scope = rememberCoroutineScope()
    val colors = Lift.colors

    val today = LocalDate.now()
    val todayEntry = entries.firstOrNull { it.date == today }
    var weightText by remember(todayEntry?.weight) {
        mutableStateOf(
            todayEntry?.weight?.let(::formatWeight)
                ?: entries.lastOrNull()?.weight?.let(::formatWeight)
                ?: "",
        )
    }
    var error by remember { mutableStateOf<String?>(null) }
    var confirmDelete by remember { mutableStateOf<Bodyweight?>(null) }

    // Keyed on offline so coming online mid-screen still refreshes.
    LaunchedEffect(offline) {
        if (!offline) repo.refreshBodyweight()
    }

    LiftScreen(title = "Bodyweight", onBack = onBack, offline = offline) {
        LazyColumn(
            Modifier.fillMaxSize().padding(horizontal = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                LiftCard(padding = 14.dp) {
                    Kicker(if (todayEntry == null) "Log today" else "Today (overwrites)")
                    Row(
                        Modifier.fillMaxWidth().padding(top = 10.dp),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        StepperField(
                            value = weightText,
                            onValueChange = { weightText = it },
                            onStep = { delta ->
                                val current = parseWeight(weightText)
                                    ?: entries.lastOrNull()?.weight ?: 80.0
                                weightText = formatWeight(roundWeight(current + delta * 0.1))
                            },
                            suffix = "KG",
                            decimal = true,
                            modifier = Modifier.weight(1f),
                        )
                        PrimaryButton(
                            "Log",
                            height = 52.dp,
                            onClick = {
                                val weight = parseWeight(weightText)
                                if (weight == null) {
                                    error = "Enter a weight"
                                } else {
                                    scope.launch {
                                        repo.logBodyweight(BodyweightInput(today, weight))
                                            .onSuccess { error = null }
                                            .onFailure { error = it.userMessage() }
                                    }
                                }
                            },
                        )
                    }
                    if (error != null) {
                        Text(
                            error ?: "",
                            style = LiftType.secondary,
                            color = colors.danger,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                    }
                }
            }

            if (entries.size >= 2) {
                item {
                    LiftCard(padding = 14.dp) {
                        Kicker("Trend")
                        TrendChart(
                            entries = entries,
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(140.dp)
                                .padding(top = 10.dp),
                        )
                    }
                }
            }

            item { Kicker("Weigh-ins") }
            if (entries.isEmpty()) {
                item { EmptyState(title = "No weigh-ins yet") }
            }
            items(entries.sortedByDescending { it.date }, key = { it.id }) { entry ->
                LiftCard(padding = 12.dp) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(entry.date.toString(), style = LiftType.mono, color = colors.ink2)
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text("${formatWeight(entry.weight)} kg", style = LiftType.rowTitle)
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
    }

    confirmDelete?.let { entry ->
        ConfirmDialog(
            title = "Delete the ${entry.date} weigh-in?",
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

/** Minimal polyline of the last 90 weigh-ins — the web chart's silhouette. */
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
