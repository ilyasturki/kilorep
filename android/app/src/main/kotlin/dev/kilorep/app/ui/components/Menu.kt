package dev.kilorep.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Popup
import androidx.compose.ui.window.PopupProperties
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcon
import dev.kilorep.app.ui.theme.LiftIcons
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text

data class LiftMenuItem(
    val label: String,
    val icon: ImageVector,
    val danger: Boolean = false,
    val onClick: () -> Unit,
)

/**
 * The ⋯ overflow menu (web's UiMenu): a bordered dots trigger opening a
 * Lift-styled popup of actions. Built on the raw Popup primitive — the app
 * deliberately carries no Material dependency.
 */
@Composable
fun LiftMenu(
    items: List<LiftMenuItem>,
    modifier: Modifier = Modifier,
    // The de-facto row-trigger size across screens; dense editor rows override.
    size: Dp = 38.dp,
    iconSize: Dp = 17.dp,
) {
    var open by remember { mutableStateOf(false) }
    val colors = Lift.colors
    Box(modifier) {
        LiftIconButton(LiftIcons.Dots, onClick = { open = true }, size = size, iconSize = iconSize)
        if (open) {
            val offsetY = with(LocalDensity.current) { (size + 4.dp).roundToPx() }
            Popup(
                alignment = Alignment.TopEnd,
                offset = IntOffset(0, offsetY),
                onDismissRequest = { open = false },
                properties = PopupProperties(focusable = true),
            ) {
                Column(
                    Modifier
                        .width(IntrinsicSize.Max)
                        .widthIn(min = 180.dp)
                        .background(colors.bg)
                        .border(1.dp, colors.line2)
                        .padding(5.dp),
                ) {
                    items.forEach { item ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clickable {
                                    open = false
                                    item.onClick()
                                }
                                .padding(horizontal = 12.dp, vertical = 11.dp),
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            LiftIcon(
                                item.icon,
                                tint = if (item.danger) colors.danger else colors.ink3,
                                size = 16.dp,
                            )
                            Text(
                                item.label,
                                style = LiftType.secondary,
                                fontWeight = FontWeight.W600,
                                color = if (item.danger) colors.danger else colors.ink2,
                                maxLines = 1,
                            )
                        }
                    }
                }
            }
        }
    }
}
