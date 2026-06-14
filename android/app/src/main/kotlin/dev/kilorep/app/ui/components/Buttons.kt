package dev.kilorep.app.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import dev.kilorep.app.ui.theme.Lift
import dev.kilorep.app.ui.theme.LiftIcon
import dev.kilorep.app.ui.theme.LiftType
import dev.kilorep.app.ui.theme.Text

/** .btn-primary — volt fill, heavy weight, square corners. */
@Composable
fun PrimaryButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector? = null,
    height: Dp = 48.dp,
) {
    val colors = Lift.colors
    Row(
        modifier = modifier
            .height(height)
            .alpha(if (enabled) 1f else 0.45f)
            .background(colors.accent)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 18.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) LiftIcon(icon, tint = colors.accentInk, size = 18.dp)
        Text(
            label,
            style = LiftType.rowTitle,
            fontWeight = FontWeight.W800,
            color = colors.accentInk,
        )
    }
}

/** .btn-ghost — hairline border, no fill. */
@Composable
fun GhostButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector? = null,
    danger: Boolean = false,
    height: Dp = 48.dp,
) {
    val colors = Lift.colors
    val ink = if (danger) colors.danger else colors.ink
    Row(
        modifier = modifier
            .height(height)
            .alpha(if (enabled) 1f else 0.45f)
            .border(1.dp, if (danger) colors.danger.copy(alpha = 0.5f) else colors.line2)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 15.dp),
        horizontalArrangement = Arrangement.spacedBy(7.dp, Alignment.CenterHorizontally),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) LiftIcon(icon, tint = ink, size = 17.dp)
        Text(
            label,
            style = LiftType.secondary,
            fontWeight = FontWeight.W600,
            fontSize = 14.sp,
            color = ink,
        )
    }
}

/** .btn-danger — solid red, for destructive confirms only. */
@Composable
fun DangerButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    height: Dp = 48.dp,
) {
    val colors = Lift.colors
    Row(
        modifier = modifier
            .height(height)
            .alpha(if (enabled) 1f else 0.45f)
            .background(colors.danger)
            .clickable(enabled = enabled, onClick = onClick)
            .padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            style = LiftType.secondary,
            fontWeight = FontWeight.W800,
            fontSize = 14.sp,
            color = Color.White,
        )
    }
}

/** .icon-btn — bordered square touch target. */
@Composable
fun LiftIconButton(
    icon: ImageVector,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    danger: Boolean = false,
    size: Dp = 44.dp,
    iconSize: Dp = 19.dp,
) {
    val colors = Lift.colors
    Row(
        modifier = modifier
            .size(size)
            .alpha(if (enabled) 1f else 0.35f)
            .border(1.dp, colors.line)
            .clickable(enabled = enabled, onClick = onClick),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        LiftIcon(
            icon,
            tint = if (danger) colors.danger else colors.ink,
            size = iconSize,
        )
    }
}

/** .btn-link — bare text affordance. */
@Composable
fun LinkButton(
    label: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    icon: ImageVector? = null,
    accent: Boolean = false,
) {
    val colors = Lift.colors
    val ink = if (accent) colors.accentText else colors.ink2
    Row(
        modifier = modifier
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp, horizontal = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        if (icon != null) LiftIcon(icon, tint = ink, size = 16.dp)
        Text(
            label,
            style = LiftType.secondary,
            fontWeight = FontWeight.W600,
            color = ink,
        )
    }
}
