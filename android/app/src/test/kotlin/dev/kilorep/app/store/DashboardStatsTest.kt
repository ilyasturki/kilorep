package dev.kilorep.app.store

import dev.kilorep.api.models.Bodyweight
import dev.kilorep.api.models.Exercise
import dev.kilorep.api.models.LoggedSet
import dev.kilorep.api.models.MuscleTarget
import dev.kilorep.api.models.WorkoutEntry
import dev.kilorep.api.models.WorkoutExercise
import dev.kilorep.api.models.WorkoutWithEntries
import java.time.LocalDate
import java.time.OffsetDateTime
import kotlin.test.Test
import kotlin.test.assertEquals

/**
 * Golden-fixture parity: a fixed history with hand-computed expected values,
 * derived from web's formulas (server/utils/dashboard.ts + shared/utils/
 * stats.ts). If either side's volume/1RM/muscle math changes, this fails —
 * the guard against the two implementations silently drifting apart.
 */
private fun mt(muscle: String, intensity: MuscleTarget.Intensity) = MuscleTarget(muscle, intensity)

private fun ex(
    exerciseId: Int,
    name: String,
    muscles: List<MuscleTarget>,
    sets: List<Triple<Double?, Int?, Boolean>>,
) = WorkoutExercise(
    id = exerciseId * 100,
    entryId = exerciseId * 100 + 1,
    exerciseId = exerciseId,
    position = 0,
    exercise = Exercise(
        id = exerciseId,
        userId = 1,
        name = name,
        equipment = Exercise.Equipment.barbell,
        type = Exercise.Type.compound,
        muscles = muscles,
        aliases = emptyList(),
    ),
    sets = sets.mapIndexed { i, s ->
        LoggedSet(
            id = exerciseId * 1000 + i,
            workoutExerciseId = exerciseId * 100,
            reps = s.second,
            weight = s.first,
            done = s.third,
            position = i,
        )
    },
)

private fun workout(id: Int, name: String, startedAt: String, exercises: List<WorkoutExercise>) =
    WorkoutWithEntries(
        id = id,
        userId = 1,
        sessionId = null,
        name = name,
        startedAt = OffsetDateTime.parse(startedAt),
        completed = true,
        entries = listOf(WorkoutEntry(id = id * 10, workoutId = id, position = 0, exercises = exercises)),
    )

private fun bw(id: Int, date: String, weight: Double) = Bodyweight(
    id = id,
    userId = 1,
    date = LocalDate.parse(date),
    weight = weight,
    createdAt = OffsetDateTime.parse("${date}T00:00:00Z"),
)

class DashboardStatsTest {

    // Newest-first, as listWorkouts returns.
    private val workouts = listOf(
        workout(
            1, "Upper", "2026-06-16T18:00:00Z",
            listOf(
                ex(
                    10, "Bench Press",
                    listOf(mt("chest", MuscleTarget.Intensity.high), mt("triceps", MuscleTarget.Intensity.medium)),
                    listOf(Triple(80.0, 8, true), Triple(80.0, 5, true)),
                ),
            ),
        ),
        workout(
            2, "Legs", "2026-06-08T18:00:00Z",
            listOf(ex(20, "Squat", listOf(mt("quads", MuscleTarget.Intensity.high)), listOf(Triple(100.0, 5, true)))),
        ),
        workout(
            3, "Old", "2026-05-01T18:00:00Z",
            listOf(ex(10, "Bench Press", emptyList(), listOf(Triple(90.0, 3, true)))),
        ),
    )

    private val weighIns = listOf(bw(1, "2026-06-01", 80.0), bw(2, "2026-06-15", 78.5))

    private val now = OffsetDateTime.parse("2026-06-17T12:00:00Z").toInstant().toEpochMilli()

    private val stats = DashboardStats.compute(workouts, weighIns, now)

    @Test
    fun `seven-day summary windows match web`() {
        // Only the 06-16 workout falls in the last 7 days; 06-08 in the prior week.
        assertEquals(PeriodStats(workouts = 1, sets = 2, volume = 1040), stats.summary.current)
        assertEquals(PeriodStats(workouts = 1, sets = 1, volume = 500), stats.summary.previous)
    }

    @Test
    fun `bodyweight glance takes latest and 30-day change`() {
        assertEquals(78.5, stats.bodyweight.current)
        assertEquals(-1.5, stats.bodyweight.change)
    }

    @Test
    fun `top muscles weight sets by intensity over the last 7 days`() {
        // Only the 06-16 bench counts: chest 2x1.0, triceps 2x0.5; quads is 9 days old.
        assertEquals(listOf("chest", "triceps"), stats.topMuscles)
    }

    @Test
    fun `recent workouts roll up the three newest`() {
        assertEquals(listOf(1, 2, 3), stats.recentWorkouts.map { it.id })
        assertEquals(1040L, stats.recentWorkouts[0].volume)
        assertEquals(2, stats.recentWorkouts[0].sets)
        assertEquals(1, stats.recentWorkouts[0].exercises)
    }

    @Test
    fun `prs keep the best epley estimate per exercise, newest first`() {
        // Bench best is 80x8 (101.3), beating the older 90x3 (99.0); squat 100x5 (116.7).
        assertEquals(listOf(10, 20), stats.prs.map { it.exerciseId })
        assertEquals(101.3, stats.prs[0].est1rm)
        assertEquals(80.0, stats.prs[0].weight)
        assertEquals(8, stats.prs[0].reps)
        assertEquals(OffsetDateTime.parse("2026-06-16T18:00:00Z"), stats.prs[0].startedAt)
        assertEquals(116.7, stats.prs[1].est1rm)
    }
}
