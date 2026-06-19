package dev.kilorep.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text

/** .card — surface fill, hairline border, square corners. */
@Composable
fun LiftCard(
    modifier: Modifier = Modifier,
    padding: Dp = 16.dp,
    content: @Composable ColumnScope.() -> Unit,
) {
    val colors = Lift.colors
    Column(
        modifier = modifier
            .background(colors.surface)
            .border(1.dp, colors.line2)
            .padding(padding),
        content = content,
    )
}

/** .kicker — mono micro-label above a section. */
@Composable
fun Kicker(text: String, modifier: Modifier = Modifier, accent: Boolean = false) {
    val colors = Lift.colors
    Text(
        text.uppercase(),
        modifier = modifier,
        style = LiftType.kicker,
        color = if (accent) colors.accentText else colors.ink3,
    )
}

/** .tag — bordered mono uppercase chip. */
@Composable
fun Tag(text: String, modifier: Modifier = Modifier, accent: Boolean = false) {
    val colors = Lift.colors
    Box(
        modifier = modifier
            .background(colors.surface2)
            .border(
                1.dp,
                if (accent) colors.accentText.copy(alpha = 0.5f) else colors.line,
            )
            .padding(horizontal = 8.dp, vertical = 4.dp),
    ) {
        Text(
            text.uppercase(),
            style = LiftType.tag,
            color = if (accent) colors.accentText else colors.ink2,
            maxLines = 1,
        )
    }
}

/**
 * .badge — muscle-intensity badge. Fill encodes how hard the muscle works:
 * solid = high, soft = medium, outline = low.
 */
@Composable
fun IntensityBadge(muscle: String, intensity: String, modifier: Modifier = Modifier) {
    val colors = Lift.colors
    val (bg, ink, line) = when (intensity) {
        "high" -> Triple(colors.accent, colors.accentInk, colors.accent)
        "medium" -> Triple(
            colors.accentTint,
            colors.accentText,
            colors.accent.copy(alpha = 0.35f),
        )
        else -> Triple(Color.Transparent, colors.ink2, colors.line2)
    }
    Box(
        modifier = modifier
            .background(bg)
            .border(1.dp, line)
            .padding(horizontal = 9.dp, vertical = 3.dp),
    ) {
        Text(
            muscle.replaceFirstChar { it.uppercase() },
            style = LiftType.secondary,
            fontWeight = androidx.compose.ui.text.font.FontWeight.W600,
            color = ink,
            maxLines = 1,
        )
    }
}

/**
 * .xmuscles — the dashboard/workout muscle readout. Rank, not intensity,
 * drives the fill: the leader is solid, the rest fade, mirroring the web's
 * TopMuscles so the visual language stays single across surfaces.
 */
@Composable
fun TopMuscles(muscles: List<String>, modifier: Modifier = Modifier) {
    if (muscles.isEmpty()) return
    val colors = Lift.colors
    Row(
        modifier = modifier,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        muscles.forEachIndexed { index, muscle ->
            val (bg, ink, line) = when (index) {
                0 -> Triple(colors.accent, colors.accentInk, colors.accent)
                1 -> Triple(
                    colors.accentTint,
                    colors.accentText,
                    colors.accent.copy(alpha = 0.35f),
                )
                else -> Triple(Color.Transparent, colors.ink2, colors.line2)
            }
            Box(
                Modifier
                    .background(bg)
                    .border(1.dp, line)
                    .padding(horizontal = 9.dp, vertical = 3.dp),
            ) {
                Text(
                    muscle.replaceFirstChar { it.uppercase() },
                    style = LiftType.secondary,
                    fontWeight = androidx.compose.ui.text.font.FontWeight.W600,
                    color = ink,
                    maxLines = 1,
                )
            }
        }
    }
}

/** .toggle — segmented control; the active option fills volt (bodyweight ranges). */
@Composable
fun SegmentedToggle(
    options: List<String>,
    selected: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val colors = Lift.colors
    Row(
        modifier = modifier.border(1.dp, colors.line2),
    ) {
        options.forEach { option ->
            val on = option == selected
            Box(
                Modifier
                    .background(if (on) colors.accent else Color.Transparent)
                    .clickable { onSelect(option) }
                    .padding(horizontal = 12.dp, vertical = 6.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    option.uppercase(),
                    style = LiftType.tag,
                    color = if (on) colors.accentInk else colors.ink2,
                )
            }
        }
    }
}

/** Section header row: kicker on the left, optional action on the right. */
@Composable
fun SectionHeader(
    title: String,
    modifier: Modifier = Modifier,
    action: (@Composable () -> Unit)? = null,
) {
    Row(
        modifier = modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Kicker(title)
        if (action != null) action()
    }
}

/**
 * .dash-stat — a big number over a small uppercase label. Boxed in a card by
 * default; pass `card = false` for the bare variant used inside an existing card.
 */
@Composable
fun StatCell(
    value: String,
    label: String,
    modifier: Modifier = Modifier,
    card: Boolean = true,
) {
    val content: @Composable ColumnScope.() -> Unit = {
        Text(value, style = LiftType.statNum, maxLines = 1)
        Text(
            label.uppercase(),
            style = LiftType.tag,
            color = Lift.colors.ink3,
            modifier = Modifier.padding(top = 4.dp),
        )
    }
    if (card) {
        LiftCard(modifier = modifier, padding = 12.dp, content = content)
    } else {
        Column(modifier, content = content)
    }
}

/** Centered empty/hint block used by lists with nothing to show. */
@Composable
fun EmptyState(title: String, hint: String? = null, modifier: Modifier = Modifier) {
    val colors = Lift.colors
    Column(
        modifier = modifier
            .fillMaxWidth()
            .border(1.dp, colors.line)
            .padding(horizontal = 20.dp, vertical = 28.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(title, style = LiftType.rowTitle, color = colors.ink2)
        if (hint != null) {
            Text(
                hint,
                style = LiftType.secondary,
                color = colors.ink3,
            )
        }
    }
}
