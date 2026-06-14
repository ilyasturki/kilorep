package dev.kilorep.app.ui.theme

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathBuilder
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.graphics.vector.rememberVectorPainter
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * The handful of stroke icons the app needs, hand-ported from the Tabler set
 * the web uses (24×24, 2px stroke, round caps) so both surfaces share the
 * same line language without bundling an icon pack.
 */
private fun strokeIcon(
    name: String,
    builder: PathBuilder.() -> Unit,
): ImageVector =
    ImageVector.Builder(
        name = name,
        defaultWidth = 24.dp,
        defaultHeight = 24.dp,
        viewportWidth = 24f,
        viewportHeight = 24f,
    ).apply {
        path(
            fill = null,
            stroke = SolidColor(Color.White),
            strokeLineWidth = 2f,
            strokeLineCap = StrokeCap.Round,
            strokeLineJoin = StrokeJoin.Round,
            pathBuilder = builder,
        )
    }.build()

private fun PathBuilder.circle(cx: Float, cy: Float, r: Float) {
    moveTo(cx + r, cy)
    arcTo(r, r, 0f, true, true, cx - r, cy)
    arcTo(r, r, 0f, true, true, cx + r, cy)
}

object LiftIcons {
    val Plus = strokeIcon("plus") {
        moveTo(12f, 5f); lineTo(12f, 19f)
        moveTo(5f, 12f); lineTo(19f, 12f)
    }
    val Minus = strokeIcon("minus") {
        moveTo(5f, 12f); lineTo(19f, 12f)
    }
    val Check = strokeIcon("check") {
        moveTo(5f, 12f); lineTo(10f, 17f); lineTo(20f, 7f)
    }
    val X = strokeIcon("x") {
        moveTo(18f, 6f); lineTo(6f, 18f)
        moveTo(6f, 6f); lineTo(18f, 18f)
    }
    val ChevronLeft = strokeIcon("chevron-left") {
        moveTo(15f, 6f); lineTo(9f, 12f); lineTo(15f, 18f)
    }
    val ChevronRight = strokeIcon("chevron-right") {
        moveTo(9f, 6f); lineTo(15f, 12f); lineTo(9f, 18f)
    }
    val ArrowUp = strokeIcon("arrow-up") {
        moveTo(12f, 19f); lineTo(12f, 5f)
        moveTo(6f, 11f); lineTo(12f, 5f); lineTo(18f, 11f)
    }
    val ArrowDown = strokeIcon("arrow-down") {
        moveTo(12f, 5f); lineTo(12f, 19f)
        moveTo(6f, 13f); lineTo(12f, 19f); lineTo(18f, 13f)
    }
    val Trash = strokeIcon("trash") {
        moveTo(4f, 7f); lineTo(20f, 7f)
        moveTo(10f, 11f); lineTo(10f, 17f)
        moveTo(14f, 11f); lineTo(14f, 17f)
        moveTo(5f, 7f); lineTo(6f, 19f)
        arcTo(2f, 2f, 0f, false, false, 8f, 21f)
        lineTo(16f, 21f)
        arcTo(2f, 2f, 0f, false, false, 18f, 19f)
        lineTo(19f, 7f)
        moveTo(9f, 7f); lineTo(9f, 4f)
        arcTo(1f, 1f, 0f, false, true, 10f, 3f)
        lineTo(14f, 3f)
        arcTo(1f, 1f, 0f, false, true, 15f, 4f)
        lineTo(15f, 7f)
    }
    val Pencil = strokeIcon("pencil") {
        moveTo(4f, 20f); lineTo(8f, 20f); lineTo(18.5f, 9.5f)
        arcTo(2.828f, 2.828f, 0f, false, false, 14.5f, 5.5f)
        lineTo(4f, 16f); close()
        moveTo(13.5f, 6.5f); lineTo(17.5f, 10.5f)
    }
    val Swap = strokeIcon("swap") {
        moveTo(3f, 8f); lineTo(20f, 8f)
        moveTo(16f, 4f); lineTo(20f, 8f); lineTo(16f, 12f)
        moveTo(21f, 16f); lineTo(4f, 16f)
        moveTo(8f, 12f); lineTo(4f, 16f); lineTo(8f, 20f)
    }
    val Search = strokeIcon("search") {
        circle(10f, 10f, 7f)
        moveTo(21f, 21f); lineTo(15f, 15f)
    }
    val Clock = strokeIcon("clock") {
        circle(12f, 12f, 9f)
        moveTo(12f, 7f); lineTo(12f, 12f); lineTo(15f, 15f)
    }
    val Barbell = strokeIcon("barbell") {
        moveTo(2f, 12f); lineTo(4f, 12f)
        moveTo(20f, 12f); lineTo(22f, 12f)
        moveTo(6f, 7f); lineTo(6f, 17f)
        moveTo(18f, 7f); lineTo(18f, 17f)
        moveTo(4f, 9f); lineTo(4f, 15f)
        moveTo(20f, 9f); lineTo(20f, 15f)
        moveTo(6f, 12f); lineTo(18f, 12f)
    }
    val Scale = strokeIcon("scale") {
        circle(12f, 12f, 9f)
        moveTo(12f, 12f); lineTo(15.5f, 8.5f)
        moveTo(7f, 12f); lineTo(8.5f, 12f)
        moveTo(15.5f, 12f); lineTo(17f, 12f)
    }
    val Refresh = strokeIcon("refresh") {
        moveTo(20f, 11f)
        arcTo(8.1f, 8.1f, 0f, false, false, 4.5f, 9f)
        moveTo(4f, 5f); lineTo(4f, 9f); lineTo(8f, 9f)
        moveTo(4f, 13f)
        arcTo(8.1f, 8.1f, 0f, false, false, 19.5f, 15f)
        moveTo(20f, 19f); lineTo(20f, 15f); lineTo(16f, 15f)
    }
    val CloudOff = strokeIcon("cloud-off") {
        moveTo(9.58f, 5.55f)
        arcTo(5.5f, 5.5f, 0f, false, true, 17.5f, 10f)
        arcTo(3.5f, 3.5f, 0f, false, true, 18.6f, 16.8f)
        moveTo(15f, 18f)
        lineTo(7f, 18f)
        arcTo(4f, 4f, 0f, false, true, 5.2f, 10.4f)
        moveTo(3f, 3f); lineTo(21f, 21f)
    }
    val Logout = strokeIcon("logout") {
        moveTo(14f, 8f); lineTo(14f, 6f)
        arcTo(2f, 2f, 0f, false, false, 12f, 4f)
        lineTo(6f, 4f)
        arcTo(2f, 2f, 0f, false, false, 4f, 6f)
        lineTo(4f, 18f)
        arcTo(2f, 2f, 0f, false, false, 6f, 20f)
        lineTo(12f, 20f)
        arcTo(2f, 2f, 0f, false, false, 14f, 18f)
        lineTo(14f, 16f)
        moveTo(9f, 12f); lineTo(21f, 12f)
        moveTo(18f, 9f); lineTo(21f, 12f); lineTo(18f, 15f)
    }
    val ListDetails = strokeIcon("list-details") {
        moveTo(13f, 5f); lineTo(21f, 5f)
        moveTo(13f, 9f); lineTo(19f, 9f)
        moveTo(13f, 15f); lineTo(21f, 15f)
        moveTo(13f, 19f); lineTo(19f, 19f)
        moveTo(3f, 4f); lineTo(9f, 4f); lineTo(9f, 10f); lineTo(3f, 10f); close()
        moveTo(3f, 14f); lineTo(9f, 14f); lineTo(9f, 20f); lineTo(3f, 20f); close()
    }
    val Settings = strokeIcon("adjustments") {
        moveTo(6f, 4f); lineTo(6f, 8f)
        moveTo(6f, 12f); lineTo(6f, 20f)
        circle(6f, 10f, 2f)
        moveTo(12f, 4f); lineTo(12f, 12f)
        moveTo(12f, 16f); lineTo(12f, 20f)
        circle(12f, 14f, 2f)
        moveTo(18f, 4f); lineTo(18f, 6f)
        moveTo(18f, 10f); lineTo(18f, 20f)
        circle(18f, 8f, 2f)
    }
    val Merge = strokeIcon("merge") {
        moveTo(7f, 4f); lineTo(7f, 8f)
        arcTo(4f, 4f, 0f, false, false, 11f, 12f)
        lineTo(17f, 12f)
        moveTo(14f, 9f); lineTo(17f, 12f); lineTo(14f, 15f)
        moveTo(7f, 12f); lineTo(7f, 20f)
    }
    val Send = strokeIcon("send") {
        moveTo(10f, 14f); lineTo(21f, 3f)
        moveTo(21f, 3f); lineTo(14.5f, 21f)
        lineTo(10f, 14f)
        lineTo(3f, 9.5f)
        close()
    }
    val Dots = strokeIcon("dots") {
        circle(5f, 12f, 1f)
        circle(12f, 12f, 1f)
        circle(19f, 12f, 1f)
    }
}

@Composable
fun LiftIcon(
    icon: ImageVector,
    modifier: Modifier = Modifier,
    tint: Color = Lift.colors.ink,
    size: Dp = 20.dp,
) {
    Image(
        painter = rememberVectorPainter(icon),
        contentDescription = null,
        modifier = modifier.size(size),
        colorFilter = ColorFilter.tint(tint),
    )
}
