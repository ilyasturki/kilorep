import type {
    DashboardData,
    DashboardPeriodStats,
    MuscleTarget,
    Workout,
} from '~~/server/database/schema'
import { toDateInput } from '~~/shared/utils/date'
import { musclesByExercise, topMuscles } from '~~/shared/utils/muscles'
import { epley1rm, workoutStats } from '~~/shared/utils/stats'

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS
const TREND_WEEKS = 8

const at = (d: Workout['startedAt']) => new Date(d).getTime()
const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Assembles the dashboard payload from the user's full workout history plus
 * weigh-ins. Loads the workout trees once (per-user data stays small) and
 * derives every widget in TypeScript so the volume/1RM/muscle definitions stay
 * shared with the app. "Now" is resolved here, on the server, once per request.
 */
export function loadDashboard(userId: number): DashboardData {
    const db = useDrizzle()

    const ids = db
        .select({ id: tables.workouts.id })
        .from(tables.workouts)
        .where(eq(tables.workouts.userId, userId))
        .all()
        .map((row) => row.id)
    // Newest-first.
    const workouts = loadWorkoutTrees(userId, ids)

    const now = Date.now()

    // --- 7-day summary vs the previous 7 days ---
    const since7 = now - WEEK_MS
    const since14 = now - 2 * WEEK_MS
    const periodStats = (lo: number, hi: number): DashboardPeriodStats => {
        let count = 0
        let sets = 0
        let volume = 0
        for (const w of workouts) {
            const t = at(w.startedAt)
            if (t < lo || t >= hi) continue
            count++
            const s = workoutStats(w.entries)
            sets += s.sets
            volume += s.volume
        }
        return { workouts: count, sets, volume }
    }
    const summary = {
        current: periodStats(since7, Infinity),
        previous: periodStats(since14, since7),
    }

    // --- eight rolling weekly volume buckets, oldest first ---
    const volumeTrend = Array.from({ length: TREND_WEEKS }, (_, i) => ({
        weekStart: toDateInput(new Date(now - (TREND_WEEKS - i) * WEEK_MS)),
        volume: 0,
    }))
    for (const w of workouts) {
        const weeksAgo = Math.floor((now - at(w.startedAt)) / WEEK_MS)
        if (weeksAgo < 0 || weeksAgo >= TREND_WEEKS) continue
        volumeTrend[TREND_WEEKS - 1 - weeksAgo]!.volume += workoutStats(
            w.entries,
        ).volume
    }

    // --- bodyweight, last 30 days (date strings sort chronologically) ---
    const weighIns = db
        .select()
        .from(tables.bodyweight)
        .where(eq(tables.bodyweight.userId, userId))
        .orderBy(asc(tables.bodyweight.date))
        .all()
    const cutoff30 = toDateInput(new Date(now - 30 * DAY_MS))
    const recentWeights = weighIns.filter((e) => e.date >= cutoff30)
    const bodyweight = {
        points: recentWeights.map((e) => ({ date: e.date, weight: e.weight })),
        current: weighIns.length ? weighIns[weighIns.length - 1]!.weight : null,
        change:
            recentWeights.length >= 2 ?
                round2(
                    recentWeights[recentWeights.length - 1]!.weight
                        - recentWeights[0]!.weight,
                )
            :   null,
    }

    // --- top five muscles trained in the last 7 days ---
    const recent7 = workouts.filter((w) => at(w.startedAt) >= since7)
    const catalog = new Map<number, { id: number; muscles: MuscleTarget[] }>()
    for (const w of recent7)
        for (const entry of w.entries)
            for (const ex of entry.exercises)
                catalog.set(ex.exercise.id, ex.exercise)
    const topMusclesList = topMuscles(
        recent7.flatMap((w) => w.entries),
        musclesByExercise([...catalog.values()]),
        5,
    )

    // --- three most recent workouts with rolled-up totals ---
    const recentWorkouts = workouts.slice(0, 3).map((w) => {
        const s = workoutStats(w.entries)
        return {
            id: w.id,
            name: w.name,
            startedAt: w.startedAt,
            completed: w.completed,
            exercises: s.exercises,
            sets: s.sets,
            volume: s.volume,
        }
    })

    // --- PRs: current best estimated-1RM per exercise, newest first ---
    type Pr = DashboardData['prs'][number]
    const best = new Map<number, Pr>()
    for (const w of workouts)
        for (const entry of w.entries)
            for (const ex of entry.exercises)
                for (const set of ex.sets) {
                    if (
                        set.weight == null
                        || set.reps == null
                        || set.weight <= 0
                        || set.reps <= 0
                    )
                        continue
                    const est1rm = epley1rm(set.weight, set.reps)
                    const prev = best.get(ex.exerciseId)
                    // Strictly greater so the recorded date is when the best was
                    // first hit; a later equal set keeps the earlier achievement.
                    if (prev && est1rm <= prev.est1rm) continue
                    best.set(ex.exerciseId, {
                        exerciseId: ex.exerciseId,
                        name: ex.exercise.name,
                        est1rm: Math.round(est1rm * 10) / 10,
                        weight: set.weight,
                        reps: set.reps,
                        workoutId: w.id,
                        startedAt: w.startedAt,
                    })
                }
    const prs = [...best.values()]
        .toSorted((a, b) => at(b.startedAt) - at(a.startedAt))
        .slice(0, 5)

    return {
        summary,
        volumeTrend,
        bodyweight,
        topMuscles: topMusclesList,
        recentWorkouts,
        prs,
    }
}
