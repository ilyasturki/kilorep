package dev.kilorep.app.ui.theme

import androidx.compose.foundation.text.BasicText
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp

/**
 * Lift's type scale (from the web's component classes). Material's Text is
 * deliberately not used; this thin BasicText wrapper defaults to
 * Archivo and the current ink.
 */
object LiftType {
    /** 30/800/-0.03em — page titles. */
    val title = TextStyle(
        fontFamily = Archivo,
        fontSize = 26.sp,
        fontWeight = FontWeight.W800,
        letterSpacing = (-0.6).sp,
    )

    /** 18/900/uppercase — the wordmark and screen headers. */
    val heading = TextStyle(
        fontFamily = Archivo,
        fontSize = 18.sp,
        fontWeight = FontWeight.W900,
        letterSpacing = 0.3.sp,
    )

    /** 15/600 — list row titles, exercise names. */
    val rowTitle = TextStyle(
        fontFamily = Archivo,
        fontSize = 16.sp,
        fontWeight = FontWeight.W600,
    )

    /** Default body. */
    val body = TextStyle(
        fontFamily = Archivo,
        fontSize = 15.sp,
        fontWeight = FontWeight.W400,
    )

    /** 13/500 — secondary lines under titles. */
    val secondary = TextStyle(
        fontFamily = Archivo,
        fontSize = 13.sp,
        fontWeight = FontWeight.W500,
    )

    /** Mono with tabular numbers — set counts, loads, dates. */
    val mono = TextStyle(
        fontFamily = JetBrainsMono,
        fontSize = 14.sp,
        fontWeight = FontWeight.W500,
    )

    /** 10.5/600/0.2em uppercase mono — the kicker label above sections. */
    val kicker = TextStyle(
        fontFamily = JetBrainsMono,
        fontSize = 11.sp,
        fontWeight = FontWeight.W600,
        letterSpacing = 2.2.sp,
    )

    /** 10.5/600/0.08em uppercase mono — tags. */
    val tag = TextStyle(
        fontFamily = JetBrainsMono,
        fontSize = 10.5.sp,
        fontWeight = FontWeight.W600,
        letterSpacing = 0.8.sp,
    )

    /** Big tappable numbers in the gym loop. */
    val statNum = TextStyle(
        fontFamily = JetBrainsMono,
        fontSize = 22.sp,
        fontWeight = FontWeight.W600,
        letterSpacing = (-0.4).sp,
    )
}

@Composable
fun Text(
    text: String,
    modifier: Modifier = Modifier,
    style: TextStyle = LiftType.body,
    color: Color = Color.Unspecified,
    fontSize: TextUnit = TextUnit.Unspecified,
    fontWeight: FontWeight? = null,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Ellipsis,
) {
    val resolved = LocalLiftColors.current.ink
    BasicText(
        text = text,
        modifier = modifier,
        style = style.merge(
            color = if (color == Color.Unspecified) resolved else color,
            fontSize = if (fontSize == TextUnit.Unspecified) style.fontSize else fontSize,
            fontWeight = fontWeight ?: style.fontWeight,
        ),
        maxLines = maxLines,
        overflow = overflow,
    )
}

/** Styled-span variant, for search-match highlighting. */
@Composable
fun Text(
    text: AnnotatedString,
    modifier: Modifier = Modifier,
    style: TextStyle = LiftType.body,
    color: Color = Color.Unspecified,
    maxLines: Int = Int.MAX_VALUE,
    overflow: TextOverflow = TextOverflow.Ellipsis,
) {
    val resolved = LocalLiftColors.current.ink
    BasicText(
        text = text,
        modifier = modifier,
        style = style.merge(color = if (color == Color.Unspecified) resolved else color),
        maxLines = maxLines,
        overflow = overflow,
    )
}
