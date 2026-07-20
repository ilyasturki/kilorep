package dev.kilorep.app.ui.components

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text

/**
 * Text with fuzzy-match positions marked — the web's UiHighlight: matched
 * characters get the accent-tinted background and accent-colored ink.
 */
@Composable
fun HighlightedText(
    text: String,
    positions: List<Int>,
    modifier: Modifier = Modifier,
    style: TextStyle = LiftType.body,
    color: Color = Color.Unspecified,
    maxLines: Int = Int.MAX_VALUE,
) {
    val colors = Lift.colors
    val mark = SpanStyle(background = colors.accentTint, color = colors.accentText)
    Text(
        text = markPositions(text, positions, mark),
        modifier = modifier,
        style = style,
        color = color,
        maxLines = maxLines,
    )
}

/** Coalesces consecutive positions into runs and applies the mark span. */
private fun markPositions(
    text: String,
    positions: List<Int>,
    mark: SpanStyle,
): AnnotatedString = buildAnnotatedString {
    append(text)
    var i = 0
    while (i < positions.size) {
        var j = i
        while (j + 1 < positions.size && positions[j + 1] == positions[j] + 1) j++
        val start = positions[i]
        val end = positions[j] + 1
        if (start >= 0 && end <= text.length) addStyle(mark, start, end)
        i = j + 1
    }
}
