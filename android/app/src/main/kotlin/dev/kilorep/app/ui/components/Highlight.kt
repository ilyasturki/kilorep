package dev.kilorep.app.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.buildAnnotatedString
import dev.kilorep.app.ui.FuzzyMatch
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
        addStyle(mark, positions[i], positions[j] + 1)
        i = j + 1
    }
}

/**
 * The web's UiMatchedLabel: the highlighted name, then the matched alias in
 * parens (its highlight shifted past the opening "(") — or, when the name
 * itself matched, a plain fallback secondary line.
 */
@Composable
fun MatchedLabel(
    name: String,
    match: FuzzyMatch,
    fallback: String?,
    modifier: Modifier = Modifier,
) {
    val colors = Lift.colors
    Column(modifier) {
        HighlightedText(name, match.labelPositions, style = LiftType.rowTitle)
        if (match.matchedKeyword != null) {
            HighlightedText(
                "(${match.matchedKeyword})",
                match.keywordPositions.map { it + 1 },
                style = LiftType.secondary,
                color = colors.ink3,
                maxLines = 1,
            )
        } else if (fallback != null) {
            Text(fallback, style = LiftType.secondary, color = colors.ink3, maxLines = 1)
        }
    }
}
