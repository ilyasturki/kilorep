package dev.kilorep.app.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dev.kilorep.app.data.Repo
import dev.kilorep.app.store.DashboardStats
import dev.kilorep.app.ui.components.Kicker
import dev.kilorep.app.ui.components.LiftCard
import dev.kilorep.app.ui.components.LiftIconButton
import dev.kilorep.app.ui.components.LiftScreen
import dev.kilorep.app.ui.components.LinkButton
import dev.kilorep.app.ui.components.StatCell
import dev.kilorep.app.ui.components.Tag
import dev.kilorep.app.ui.components.TopMuscles
import dev.kilorep.app.ui.formatDay
import dev.kilorep.app.ui.formatFixed2
import dev.kilorep.app.ui.formatSigned
import dev.kilorep.app.ui.formatVolume
import dev.kilorep.app.ui.formatWeight
import dev.kilorep.app.ui.plural
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text
import dev.kilorep.app.ui.watch

/**
 * The home screen (web's /dashboard): a 7-day training summary with
 * week-over-week deltas, a bodyweight glance, muscle coverage, recent
 * workouts and personal records — all computed on-device by
 * [DashboardStats] so it works offline. Hosts the Start/Continue CTA and the
 * entry to the profile area (Weight, Settings). The 8-week volume trend chart
 * is deferred for v1.
 */
@Composable
fun DashboardScreen(
    repo: Repo,
    offline: Boolean,
    onOpenDraft: (String) -> Unit,
    onOpenServerWorkout: (Int) -> Unit,
    onOpenExercise: (Int) -> Unit,
    onSeeAllWorkouts: () -> Unit,
    onProfile: () -> Unit,
) {
    val workouts = repo.workouts.watch()
    val weighIns = repo.bodyweight.watch()

    LaunchedEffect(offline) {
        if (!offline) {
            repo.refreshAll()
            repo.refreshBodyweight()
        }
    }

    val now = remember { System.currentTimeMillis() }
    // Recomputes whenever the cache changes; the formulas are pinned to web's
    // by DashboardStatsTest.
    val stats = remember(workouts, weighIns) {
        DashboardStats.compute(workouts, weighIns, now)
    }

    LiftScreen(
        title = "Dashboard",
        offline = offline,
        actions = {
            LiftIconButton(LiftIcons.User, onClick = onProfile, size = 40.dp, iconSize = 19.dp)
        },
    ) {
        LazyColumn(
            Modifier.fillMaxSize().padding(horizontal = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            item {
                WorkoutStartButton(
                    repo = repo,
                    onOpen = onOpenDraft,
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                )
            }

            // 7-day summary with week-over-week deltas.
            item {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    SummaryCell(
                        "Workouts · 7D",
                        stats.summary.current.workouts.toString(),
                        stats.summary.current.workouts - stats.summary.previous.workouts,
                        { it.toString() },
                        Modifier.weight(1f),
                    )
                    SummaryCell(
                        "Sets · 7D",
                        stats.summary.current.sets.toString(),
                        stats.summary.current.sets - stats.summary.previous.sets,
                        { it.toString() },
                        Modifier.weight(1f),
                    )
                    SummaryCell(
                        "Volume · 7D",
                        formatVolume(stats.summary.current.volume),
                        (stats.summary.current.volume - stats.summary.previous.volume).toInt(),
                        { formatVolume(it.toLong()) },
                        Modifier.weight(1f),
                    )
                }
            }

            // Bodyweight, last 30 days.
            item {
                LiftCard(padding = 14.dp) {
                    Kicker("Bodyweight · last 30 days")
                    val bw = stats.bodyweight
                    if (bw.current == null) {
                        DashEmpty("No weigh-ins in the last 30 days.")
                    } else {
                        Row(
                            Modifier.fillMaxWidth().padding(top = 10.dp),
                            horizontalArrangement = Arrangement.spacedBy(24.dp),
                        ) {
                            StatCell(formatFixed2(bw.current), "Current · kg", card = false)
                            StatCell(
                                bw.change?.let(::formatSigned) ?: "—",
                                "Change · 30d",
                                card = false,
                            )
                        }
                    }
                }
            }

            // Muscles trained, last 7 days.
            item {
                LiftCard(padding = 14.dp) {
                    Kicker("Muscles · last 7 days")
                    if (stats.topMuscles.isEmpty()) {
                        DashEmpty("Train something this week to see muscle coverage.")
                    } else {
                        TopMuscles(stats.topMuscles, Modifier.padding(top = 10.dp))
                    }
                }
            }

            // Recent workouts.
            item {
                LiftCard(padding = 14.dp) {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Kicker("Recent workouts")
                        LinkButton("All", onClick = onSeeAllWorkouts, accent = true)
                    }
                    if (stats.recentWorkouts.isEmpty()) {
                        DashEmpty("No workouts yet. Start one from a session.")
                    } else {
                        stats.recentWorkouts.forEach { w ->
                            DashRow(
                                name = w.name,
                                sub = listOf(
                                    plural(w.exercises, "exercise"),
                                    plural(w.sets, "set"),
                                    "${formatVolume(w.volume)} kg",
                                ).joinToString("  ·  "),
                                trailing = if (w.completed) formatDay(w.startedAt) else "In progress",
                                accent = !w.completed,
                                onClick = { onOpenServerWorkout(w.id) },
                            )
                        }
                    }
                }
            }

            // Personal records.
            item {
                LiftCard(padding = 14.dp) {
                    Kicker("Personal records")
                    if (stats.prs.isEmpty()) {
                        DashEmpty("Log some sets to start setting records.")
                    } else {
                        stats.prs.forEach { pr ->
                            DashRow(
                                name = pr.name,
                                sub = "${formatWeight(pr.weight)} kg × ${pr.reps} · ${formatDay(pr.startedAt)}",
                                trailing = "${formatWeight(pr.est1rm)} est.",
                                accent = false,
                                mono = true,
                                onClick = { onOpenExercise(pr.exerciseId) },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SummaryCell(
    label: String,
    value: String,
    delta: Int,
    render: (Int) -> String,
    modifier: Modifier = Modifier,
) {
    val colors = Lift.colors
    LiftCard(modifier = modifier, padding = 12.dp) {
        Kicker(label)
        Text(
            value,
            style = LiftType.statNum,
            modifier = Modifier.padding(top = 6.dp),
            maxLines = 1,
        )
        Text(
            when {
                delta == 0 -> "No change"
                delta > 0 -> "+${render(delta)} vs prev 7d"
                else -> "-${render(-delta)} vs prev 7d"
            },
            style = LiftType.tag,
            color = when {
                delta > 0 -> colors.accentText
                delta < 0 -> colors.danger
                else -> colors.ink3
            },
            modifier = Modifier.padding(top = 4.dp),
            maxLines = 2,
        )
    }
}

@Composable
private fun DashRow(
    name: String,
    sub: String,
    trailing: String,
    accent: Boolean,
    onClick: () -> Unit,
    mono: Boolean = false,
) {
    val colors = Lift.colors
    Row(
        Modifier.fillMaxWidth().clickable(onClick = onClick).padding(top = 10.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(name, style = LiftType.rowTitle, maxLines = 1)
            Text(sub, style = LiftType.secondary, color = colors.ink2, modifier = Modifier.padding(top = 2.dp), maxLines = 1)
        }
        if (mono) {
            Text(trailing, style = LiftType.mono, color = colors.accentText, maxLines = 1)
        } else {
            Tag(trailing, accent = accent)
        }
    }
}

@Composable
private fun DashEmpty(text: String) {
    Text(
        text,
        style = LiftType.secondary,
        color = Lift.colors.ink3,
        modifier = Modifier.padding(top = 10.dp),
    )
}
