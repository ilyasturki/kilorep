@file:OptIn(ExperimentalTextApi::class)

package dev.kilorep.app.ui.theme

import androidx.compose.foundation.Indication
import androidx.compose.foundation.IndicationNodeFactory
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.interaction.InteractionSource
import androidx.compose.foundation.interaction.PressInteraction
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.ContentDrawScope
import androidx.compose.ui.node.DelegatableNode
import androidx.compose.ui.node.DrawModifierNode
import androidx.compose.ui.node.invalidateDraw
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.text.font.FontWeight
import dev.kilorep.app.R
import kotlinx.coroutines.launch

/**
 * Lift — brutalist-sharp design system, ported from the web tokens in
 * app/assets/css/main.css. Dark-first, square corners, hairline
 * borders, one volt accent. Token changes on the web must be mirrored here
 * by hand.
 */
@Immutable
data class LiftColors(
    val accent: Color,
    val accentInk: Color,
    val bg: Color,
    val surface: Color,
    val surface2: Color,
    val line: Color,
    val line2: Color,
    val ink: Color,
    val ink2: Color,
    val ink3: Color,
    val accentTint: Color,
    val accentText: Color,
    val danger: Color,
    val isDark: Boolean,
)

val LiftDark = LiftColors(
    accent = Color(0xFFC5F53A),
    accentInk = Color(0xFF0B0B0C),
    bg = Color(0xFF0B0B0C),
    surface = Color(0xFF141416),
    surface2 = Color(0xFF1A1A1D),
    line = Color(0x1AFFFFFF),
    line2 = Color(0x2EFFFFFF),
    ink = Color(0xFFF4F4F5),
    ink2 = Color(0xFF9A9AA0),
    ink3 = Color(0xFF5E5E66),
    accentTint = Color(0x24C5F53A),
    accentText = Color(0xFFC5F53A),
    danger = Color(0xFFE5484D),
    isDark = true,
)

val LiftLight = LiftColors(
    accent = Color(0xFFC5F53A),
    accentInk = Color(0xFF0B0B0C),
    bg = Color(0xFFECEBE6),
    surface = Color(0xFFFFFFFF),
    surface2 = Color(0xFFF4F3EF),
    line = Color(0x1F000000),
    line2 = Color(0x38000000),
    ink = Color(0xFF17171A),
    ink2 = Color(0xFF5C5C62),
    ink3 = Color(0xFF9A9A9F),
    accentTint = Color(0x2EC5F53A),
    // The web mixes accent 58% with black for readable accent text on light.
    accentText = Color(0xFF5A7411),
    danger = Color(0xFFE5484D),
    isDark = false,
)

val LocalLiftColors = staticCompositionLocalOf { LiftDark }

private fun archivo(weight: Int) = Font(
    R.font.archivo,
    FontWeight(weight),
    variationSettings = FontVariation.Settings(
        FontVariation.weight(weight),
        FontVariation.width(100f),
    ),
)

private fun mono(weight: Int) = Font(
    R.font.jetbrains_mono,
    FontWeight(weight),
    variationSettings = FontVariation.Settings(FontVariation.weight(weight)),
)

/** Archivo carries all UI text; JetBrains Mono carries numbers and kickers. */
val Archivo = FontFamily(
    archivo(400), archivo(500), archivo(600),
    archivo(700), archivo(800), archivo(900),
)

val JetBrainsMono = FontFamily(mono(400), mono(500), mono(600), mono(700))

/**
 * The web has no ripple — interaction feedback is border/background shifts.
 * A flat press overlay keeps touch feedback native-feeling without Material.
 */
private object LiftIndication : IndicationNodeFactory {
    override fun create(interactionSource: InteractionSource): DelegatableNode =
        PressOverlayNode(interactionSource)

    override fun equals(other: Any?) = other === this
    override fun hashCode() = -1

    private class PressOverlayNode(
        private val interactionSource: InteractionSource,
    ) : androidx.compose.ui.Modifier.Node(), DrawModifierNode {
        private var pressed = false

        override fun onAttach() {
            coroutineScope.launch {
                interactionSource.interactions.collect { interaction ->
                    val now = when (interaction) {
                        is PressInteraction.Press -> true
                        is PressInteraction.Release, is PressInteraction.Cancel -> false
                        else -> pressed
                    }
                    if (now != pressed) {
                        pressed = now
                        invalidateDraw()
                    }
                }
            }
        }

        override fun ContentDrawScope.draw() {
            drawContent()
            if (pressed) drawRect(Color.White.copy(alpha = 0.06f))
        }
    }
}

@Composable
fun LiftTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) LiftDark else LiftLight
    CompositionLocalProvider(
        LocalLiftColors provides colors,
        LocalIndication provides (LiftIndication as Indication),
        content = content,
    )
}

/** Shorthand the components and screens read tokens through. */
object Lift {
    val colors: LiftColors
        @Composable get() = LocalLiftColors.current
}
