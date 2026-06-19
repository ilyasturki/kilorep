package dev.kilorep.app.store

import dev.kilorep.api.models.Bodyweight
import dev.kilorep.api.models.MuscleTarget
import dev.kilorep.api.models.WorkoutWithEntries
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import kotlin.math.roundToLong

/**
 * The dashboard, computed on-device from the cached workout history and
 * weigh-ins. The web derives the same payload on the server (server/utils/
 * dashboard.ts); this mirrors its volume/1RM/muscle definitions exactly so the
 * numbers match, and stays offline-capable. The parity is pinned by
 * DashboardStatsTest — keep the two in lockstep when either formula changes.
 *
 * Pure Kotlin (no Android imports) so it runs as a plain JVM unit test. The
 * active workout still lives in `drafts` until it syncs, so it joins these
 * figures only once it lands in the history cache.
 */
data class PeriodStats(val workouts: Int, val sets: Int, val volume: Long)

data class DashboardSummary(val current: PeriodStats, val previous: PeriodStats)

data class BodyweightGlance(val current: Double?, val change: Double?)

data class RecentWorkout(
    val id: Int,
    val name: String,
    val startedAt: OffsetDateTime,
    val completed: Boolean,
    val exercises: Int,
    val sets: Int,
    val volume: Long,
)

data class Pr(
    val exerciseId: Int,
    val name: String,
    val est1rm: Double,
    val weight: Double,
    val reps: Int,
    val startedAt: OffsetDateTime,
)

data class DashboardStats(
    val summary: DashboardSummary,
    val bodyweight: BodyweightGlance,
    val topMuscles: List<String>,
    val recentWorkouts: List<RecentWorkout>,
    val prs: List<Pr>,
) {
    companion object {
        private const val DAY_MS = 86_400_000L
        private const val WEEK_MS = 7 * DAY_MS

        // Epley estimated 1RM: a single rep returns the weight itself.
        fun epley1rm(weight: Double, reps: Int): Double = weight * (1 + reps / 30.0)

        private fun round1(n: Double): Double = (n * 10).roundToLong() / 10.0
        private fun round2(n: Double): Double = (n * 100).roundToLong() / 100.0

        fun intensityWeight(value: String): Double = when (value) {
            "high" -> 1.0
            "medium" -> 0.5
            "low" -> 0.25
            else -> 0.0
        }

        /**
         * Rank muscles by Σ(setCount × intensity), strongest first — the single
         * scoring rule shared by the dashboard and the workouts list, mirroring
         * web's shared/utils/muscles.ts:topMuscles.
         */
        fun topMuscles(perExercise: List<Pair<List<MuscleTarget>, Int>>, limit: Int): List<String> {
            val scores = LinkedHashMap<String, Double>()
            for ((muscles, setCount) in perExercise) {
                for (m in muscles) {
                    scores[m.muscle] = (scores[m.muscle] ?: 0.0) +
                        setCount * intensityWeight(m.intensity.value)
                }
            }
            return scores.entries.sortedByDescending { it.value }.take(limit).map { it.key }
        }

        private data class Rollup(val exercises: Int, val sets: Int, val volume: Long)

        // Volume is load × reps over every set (un-entered fields count 0),
        // rounded per workout — matching shared/utils/stats.ts:workoutStats.
        private fun rollup(w: WorkoutWithEntries): Rollup {
            var exercises = 0
            var sets = 0
            var volume = 0.0
            for (entry in w.entries) for (ex in entry.exercises) {
                exercises++
                sets += ex.sets.size
                for (s in ex.sets) volume += (s.weight ?: 0.0) * (s.reps ?: 0)
            }
            return Rollup(exercises, sets, volume.roundToLong())
        }

        /**
         * @param workouts cached history, newest first (as listWorkouts returns).
         * @param nowMillis "now", resolved by the caller for testability.
         */
        fun compute(
            workouts: List<WorkoutWithEntries>,
            weighIns: List<Bodyweight>,
            nowMillis: Long,
        ): DashboardStats {
            fun at(w: WorkoutWithEntries) = w.startedAt.toInstant().toEpochMilli()
            val since7 = nowMillis - WEEK_MS
            val since14 = nowMillis - 2 * WEEK_MS

            fun period(lo: Long, hi: Long): PeriodStats {
                var count = 0
                var sets = 0
                var volume = 0L
                for (w in workouts) {
                    val t = at(w)
                    if (t < lo || t >= hi) continue
                    count++
                    val r = rollup(w)
                    sets += r.sets
                    volume += r.volume
                }
                return PeriodStats(count, sets, volume)
            }
            val summary = DashboardSummary(
                current = period(since7, Long.MAX_VALUE),
                previous = period(since14, since7),
            )

            // --- bodyweight, last 30 days (oldest weigh-in first) ---
            val sortedWeights = weighIns.sortedBy { it.date }
            val cutoff30 = Instant.ofEpochMilli(nowMillis - 30 * DAY_MS)
                .atZone(ZoneOffset.UTC).toLocalDate()
            val recentWeights = sortedWeights.filter { !it.date.isBefore(cutoff30) }
            val bodyweight = BodyweightGlance(
                current = sortedWeights.lastOrNull()?.weight,
                change = if (recentWeights.size >= 2) {
                    round2(recentWeights.last().weight - recentWeights.first().weight)
                } else {
                    null
                },
            )

            // --- top five muscles trained in the last 7 days ---
            val recentExercises = buildList {
                for (w in workouts) {
                    if (at(w) < since7) continue
                    for (entry in w.entries) for (ex in entry.exercises) {
                        add(ex.exercise.muscles to ex.sets.size)
                    }
                }
            }
            val topMuscles = topMuscles(recentExercises, limit = 5)

            // --- three most recent workouts ---
            val recentWorkouts = workouts.take(3).map { w ->
                val r = rollup(w)
                RecentWorkout(w.id, w.name, w.startedAt, w.completed, r.exercises, r.sets, r.volume)
            }

            // --- PRs: current best estimated-1RM per exercise, newest first ---
            val best = LinkedHashMap<Int, Pr>()
            for (w in workouts) for (entry in w.entries) for (ex in entry.exercises) {
                for (s in ex.sets) {
                    val weight = s.weight
                    val reps = s.reps
                    if (weight == null || reps == null || weight <= 0 || reps <= 0) continue
                    val est = epley1rm(weight, reps)
                    val prev = best[ex.exerciseId]
                    // Strictly greater: the earlier achievement keeps the record.
                    if (prev != null && est <= prev.est1rm) continue
                    best[ex.exerciseId] = Pr(
                        exerciseId = ex.exerciseId,
                        name = ex.exercise.name,
                        est1rm = round1(est),
                        weight = weight,
                        reps = reps,
                        startedAt = w.startedAt,
                    )
                }
            }
            val prs = best.values
                .sortedByDescending { it.startedAt.toInstant().toEpochMilli() }
                .take(5)

            return DashboardStats(summary, bodyweight, topMuscles, recentWorkouts, prs)
        }
    }
}
