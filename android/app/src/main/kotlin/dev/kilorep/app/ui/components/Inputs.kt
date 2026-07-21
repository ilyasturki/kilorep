package dev.kilorep.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.text.TextRange
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcon
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text

/** .input — bordered text field, accent border when focused. */
@Composable
fun LiftTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "",
    keyboardOptions: KeyboardOptions = KeyboardOptions.Default,
    singleLine: Boolean = true,
    textStyle: TextStyle = LiftType.body,
    leadingIcon: (@Composable () -> Unit)? = null,
) {
    val colors = Lift.colors
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    BasicTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        interactionSource = interaction,
        keyboardOptions = keyboardOptions,
        singleLine = singleLine,
        textStyle = textStyle.merge(color = colors.ink),
        cursorBrush = SolidColor(colors.accent),
        decorationBox = { inner ->
            Row(
                modifier = Modifier
                    .background(colors.surface)
                    .border(1.dp, if (focused) colors.accent else colors.line2)
                    .padding(horizontal = 13.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(9.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                if (leadingIcon != null) leadingIcon()
                Box(Modifier.weight(1f)) {
                    if (value.isEmpty() && placeholder.isNotEmpty()) {
                        Text(placeholder, style = textStyle, color = colors.ink3, maxLines = 1)
                    }
                    inner()
                }
            }
        },
    )
}

/** .search-box — input with the leading search glyph. */
@Composable
fun SearchBox(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String = "Search",
) {
    LiftTextField(
        value = value,
        onValueChange = onValueChange,
        modifier = modifier,
        placeholder = placeholder,
        leadingIcon = { LiftIcon(LiftIcons.Search, tint = Lift.colors.ink3, size = 17.dp) },
    )
}

/**
 * The gym loop's number control: thumb-sized − / + around an editable
 * value. Tapping the value selects it whole, so retyping replaces rather
 * than appends — two seconds between efforts, one hand.
 */
@Composable
fun StepperField(
    value: String,
    onValueChange: (String) -> Unit,
    onStep: (Int) -> Unit,
    modifier: Modifier = Modifier,
    suffix: String? = null,
    decimal: Boolean = false,
) {
    val colors = Lift.colors
    var fieldValue by remember {
        mutableStateOf(TextFieldValue(value, TextRange(value.length)))
    }
    // Keying the remember on `value` would reset the cursor to the front on
    // every keystroke's ViewModel round-trip. Instead resync only when the
    // canonical value actually changed (a stepper tap, another writer, or a
    // normalization like "012" -> "12") and diverges from the local text;
    // an unchanged echo (e.g. "82." parsing back to 82) keeps in-progress
    // typing intact.
    var lastValue by remember { mutableStateOf(value) }
    if (value != lastValue) {
        lastValue = value
        if (value != fieldValue.text) {
            fieldValue = TextFieldValue(value, TextRange(value.length))
        }
    }
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    LaunchedEffect(focused) {
        if (focused) {
            fieldValue = fieldValue.copy(selection = TextRange(0, fieldValue.text.length))
        }
    }

    Row(
        modifier = modifier
            .height(52.dp)
            .background(colors.surface)
            .border(1.dp, if (focused) colors.accent else colors.line2),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            Modifier
                .fillMaxHeight()
                .width(44.dp)
                .clickable { onStep(-1) },
            contentAlignment = Alignment.Center,
        ) {
            LiftIcon(LiftIcons.Minus, tint = colors.ink2, size = 18.dp)
        }
        Row(
            Modifier.weight(1f).padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            // The value takes whatever sits between − and + (a fixed width
            // clipped long loads like 102.5 on narrow screens). A single-line
            // field scrolls rather than wraps, so when even that is too
            // narrow, step the font down until the whole number is visible.
            val measurer = rememberTextMeasurer()
            var slotWidth by remember { mutableIntStateOf(0) }
            val fontSize = remember(fieldValue.text, slotWidth) {
                var size = LiftType.statNum.fontSize
                while (slotWidth > 0 && size > 13.sp &&
                    measurer.measure(
                        fieldValue.text,
                        LiftType.statNum.copy(fontSize = size),
                    ).size.width > slotWidth
                ) {
                    size *= 0.9f
                }
                size
            }
            BasicTextField(
                value = fieldValue,
                onValueChange = {
                    fieldValue = it
                    onValueChange(it.text)
                },
                interactionSource = interaction,
                keyboardOptions = KeyboardOptions(
                    keyboardType = if (decimal) KeyboardType.Decimal else KeyboardType.Number,
                ),
                singleLine = true,
                textStyle = LiftType.statNum.merge(
                    color = if (value.isEmpty()) colors.ink3 else colors.ink,
                    textAlign = TextAlign.Center,
                    fontSize = fontSize,
                ),
                cursorBrush = SolidColor(colors.accent),
                modifier = Modifier
                    .weight(1f)
                    .onSizeChanged { slotWidth = it.width },
            )
            if (suffix != null) {
                Text(suffix, style = LiftType.tag, color = colors.ink3)
            }
        }
        Box(
            Modifier
                .fillMaxHeight()
                .width(44.dp)
                .clickable { onStep(1) },
            contentAlignment = Alignment.Center,
        ) {
            LiftIcon(LiftIcons.Plus, tint = colors.ink2, size = 18.dp)
        }
    }
}
