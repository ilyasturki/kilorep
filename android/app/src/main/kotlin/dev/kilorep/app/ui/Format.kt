package dev.kilorep.app.ui

import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.roundToInt

private val dayFormat = DateTimeFormatter.ofPattern("EEE d MMM", Locale.ENGLISH)
private val dayYearFormat = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH)

fun formatDay(iso: String): String = runCatching {
    OffsetDateTime.parse(iso).atZoneSameInstant(ZoneId.systemDefault()).format(dayFormat)
}.getOrDefault(iso)

fun formatDay(value: OffsetDateTime): String =
    value.atZoneSameInstant(ZoneId.systemDefault()).format(dayFormat)

fun formatDate(date: LocalDate): String = date.format(dayYearFormat)

/** Loads render like the web: trailing zeros dropped, kg implied. */
fun formatWeight(weight: Double?): String = when {
    weight == null -> "—"
    weight % 1.0 == 0.0 -> weight.toInt().toString()
    else -> weight.toString().trimEnd('0').trimEnd('.')
}

/**
 * The unit that follows a weight, from the exercise's load mode (wire value —
 * pass the generated enum's `.value`). Matches web's weightUnit().
 */
fun weightUnit(loadMode: String?): String = when (loadMode) {
    "per-hand" -> "kg/hand"
    "unilateral" -> "kg/side"
    else -> "kg"
}

/** Reps render like loads: whole counts plain, a half-rep keeps its ".5". */
fun formatReps(reps: Double?): String = when {
    reps == null -> "?"
    reps % 1.0 == 0.0 -> reps.toInt().toString()
    else -> reps.toString().trimEnd('0').trimEnd('.')
}

/** "1 set" / "2 sets" — the web's plural() for the simple nouns we count. */
fun plural(count: Int, noun: String): String =
    "$count $noun${if (count == 1) "" else "s"}"

/** Signed two-decimal kg delta ("+1.50" / "-0.80"), matching web's fmtSigned2. */
fun formatSigned(value: Double): String {
    val sign = if (value > 0) "+" else if (value < 0) "-" else ""
    return "$sign${String.format(Locale.ENGLISH, "%.2f", kotlin.math.abs(value))}"
}

/** Two-decimal kg ("78.50"), matching web's fmtFixed2 for bodyweight stats. */
fun formatFixed2(value: Double): String = String.format(Locale.ENGLISH, "%.2f", value)

/** Whole-number volume with thousands grouping, matching web's fmtVolume. */
fun formatVolume(value: Long): String =
    String.format(Locale.ENGLISH, "%,d", value)

/** Comma-tolerant weight entry ("82,5" from a numeric keypad locale). */
fun parseWeight(text: String): Double? = text.trim().replace(',', '.').toDoubleOrNull()

/** Comma-tolerant rep entry; half-reps ("6,5") are loggable like a load. */
fun parseReps(text: String): Double? = text.trim().replace(',', '.').toDoubleOrNull()

/**
 * Stepper math on binary doubles drifts (80.1 + 0.1 -> 80.19999…); quantize
 * results before display. Two decimals rather than one so quarter-kg loads
 * (e.g. 22.25 + 2.5) survive the workout stepper untouched.
 */
fun roundWeight(weight: Double): Double = (weight * 100).roundToInt() / 100.0

/** "3×8 · 80 kg" style summary for history rows. */
fun setSummary(sets: List<Pair<Int?, Double?>>): String {
    if (sets.isEmpty()) return "no sets"
    val best = sets.maxByOrNull { it.second ?: 0.0 }
    val load = best?.second?.let { " · ${formatWeight(it)} kg" } ?: ""
    return "${sets.size} set${if (sets.size == 1) "" else "s"}$load"
}
