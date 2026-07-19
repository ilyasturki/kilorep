<script setup lang="ts">
import type { DashboardData } from '~~/server/database/schema'

const { data, status, refresh } = await useFetch<DashboardData>(
    PAYLOAD.dashboard,
    {
        key: PAYLOAD.dashboard,
        server: false,
        lazy: true,
        getCachedData: cachedPayload,
    },
)
revalidate({ status, refresh })
const loading = initialLoading({ status })

// Relative day labels depend on "now"; resolve it after mount so the value is
// the viewer's own clock (the app renders client-side, but this also keeps the
// helper's contract — `now` is injected, never read mid-render).
const now = ref<Date>()
onMounted(() => {
    now.value = new Date()
})
const dayLabel = (d: DashboardData['recentWorkouts'][number]['startedAt']) =>
    now.value ? fmtRelativeDay(d, now.value) : fmtDate(d)

// Summary cards: current 7d value with a signed change against the prior 7d.
type Metric = {
    key: 'workouts' | 'sets' | 'volume'
    label: string
    unit?: string
}
const METRICS: Metric[] = [
    { key: 'workouts', label: 'Workouts' },
    { key: 'sets', label: 'Sets' },
    { key: 'volume', label: 'Volume', unit: 'kg' },
]
const delta = (m: Metric) => {
    const s = data.value?.summary
    if (!s) return null
    return s.current[m.key] - s.previous[m.key]
}
const deltaText = (d: number) => `${d > 0 ? '+' : ''}${fmtVolume(d)}`

const volumePoints = computed(() =>
    (data.value?.volumeTrend ?? []).map((b) => ({
        label: fmtDateShort(parseLocalDay(b.weekStart)),
        value: b.volume,
    })),
)
const hasVolume = computed(() =>
    (data.value?.volumeTrend ?? []).some((b) => b.volume > 0),
)

const weightPoints = computed(() =>
    (data.value?.bodyweight.points ?? []).map((p) => ({
        x: parseLocalDay(p.date).getTime(),
        y: p.weight,
    })),
)
</script>

<template>
    <UiEmpty v-if="loading"> Loading… </UiEmpty>

    <div v-else-if="data">
        <!-- 7-day summary with week-over-week deltas -->
        <div class="dash-stats mb-6">
            <UiCard
                v-for="m in METRICS"
                :key="m.key"
                class="dash-stat"
            >
                <span class="stat-lab max-sm:tracking-[0.06em]">
                    {{ m.label }} · 7D
                </span>
                <span class="stat-num mono text-[26px] max-sm:text-[18px]">
                    {{ fmtVolume(data.summary.current[m.key]) }}
                    <span
                        v-if="m.unit"
                        class="dash-unit"
                        >{{ m.unit }}</span
                    >
                </span>
                <span
                    v-if="delta(m) !== null"
                    class="dash-delta mono"
                    :class="{
                        'dash-delta--up': delta(m)! > 0,
                        'dash-delta--down': delta(m)! < 0,
                    }"
                >
                    {{ delta(m) === 0 ? 'No change' : deltaText(delta(m)!) }}
                    <span v-if="delta(m) !== 0">vs prev 7d</span>
                </span>
            </UiCard>
        </div>

        <div class="dash-grid">
            <!-- Volume trend (headline, full width) -->
            <UiCard class="dash-span min-w-0">
                <UiCardHead class="mb-4">
                    <span class="kicker">Volume · last 8 weeks</span>
                </UiCardHead>
                <div class="wchart">
                    <ClientOnly v-if="hasVolume">
                        <VolumeChart :points="volumePoints" />
                        <template #fallback>
                            <div class="wchart-loading" />
                        </template>
                    </ClientOnly>
                    <div
                        v-else
                        class="wchart-empty"
                    >
                        No volume logged in the last 8 weeks.
                    </div>
                </div>
            </UiCard>

            <!-- Bodyweight, last 30 days -->
            <UiCard class="min-w-0">
                <UiCardHead class="mb-4">
                    <span class="kicker">Bodyweight · last 30 days</span>
                </UiCardHead>
                <template v-if="data.bodyweight.points.length">
                    <div class="dash-bw-stats">
                        <div class="dash-bw-stat">
                            <span class="stat-num mono text-[22px]">{{
                                data.bodyweight.current != null ?
                                    fmtFixed2(data.bodyweight.current)
                                :   '—'
                            }}</span>
                            <span class="stat-lab">Current · kg</span>
                        </div>
                        <div class="dash-bw-stat">
                            <span class="stat-num mono text-[22px]">{{
                                data.bodyweight.change == null ?
                                    '—'
                                :   fmtSigned2(data.bodyweight.change)
                            }}</span>
                            <span class="stat-lab">Change · 30d</span>
                        </div>
                    </div>
                    <div class="wchart wchart--sm">
                        <ClientOnly>
                            <WeightChart
                                :points="weightPoints"
                                time-unit="day"
                            />
                            <template #fallback>
                                <div class="wchart-loading" />
                            </template>
                        </ClientOnly>
                    </div>
                </template>
                <div
                    v-else
                    class="dash-empty"
                >
                    No weigh-ins in the last 30 days.
                </div>
            </UiCard>

            <!-- Muscles trained, last 7 days -->
            <UiCard class="min-w-0">
                <UiCardHead class="mb-4">
                    <span class="kicker">Muscles · last 7 days</span>
                </UiCardHead>
                <TopMuscles
                    v-if="data.topMuscles.length"
                    :muscles="data.topMuscles"
                />
                <div
                    v-else
                    class="dash-empty"
                >
                    Train something this week to see muscle coverage.
                </div>
            </UiCard>

            <!-- Recent workouts -->
            <UiCard class="min-w-0">
                <UiCardHead class="mb-4">
                    <span class="kicker">Recent workouts</span>
                    <NuxtLink
                        to="/workouts"
                        class="dash-more"
                        >All</NuxtLink
                    >
                </UiCardHead>
                <div
                    v-if="data.recentWorkouts.length"
                    class="dash-list"
                >
                    <NuxtLink
                        v-for="w in data.recentWorkouts"
                        :key="w.id"
                        :to="`/workouts/${w.id}`"
                        class="dash-row"
                    >
                        <div class="dash-row-main">
                            <span class="dash-row-name">{{ w.name }}</span>
                            <span class="dash-row-sub">
                                {{ plural(w.exercises, 'exercise') }} ·
                                {{ plural(w.sets, 'set') }} ·
                                {{ fmtVolume(w.volume) }} kg
                            </span>
                        </div>
                        <UiTag :accent="!w.completed">
                            {{
                                w.completed ?
                                    dayLabel(w.startedAt)
                                :   'In progress'
                            }}
                        </UiTag>
                    </NuxtLink>
                </div>
                <div
                    v-else
                    class="dash-empty"
                >
                    No workouts yet. Start one from a session template.
                </div>
            </UiCard>

            <!-- Personal records -->
            <UiCard class="min-w-0">
                <UiCardHead class="mb-4">
                    <span class="kicker">Personal records</span>
                </UiCardHead>
                <div
                    v-if="data.prs.length"
                    class="dash-list"
                >
                    <NuxtLink
                        v-for="pr in data.prs"
                        :key="pr.exerciseId"
                        :to="`/exercises/${pr.exerciseId}`"
                        class="dash-row"
                    >
                        <div class="dash-row-main">
                            <span class="dash-row-name">{{ pr.name }}</span>
                            <span class="dash-row-sub">
                                {{ fmtWeight(pr.weight) }} kg × {{ pr.reps }} ·
                                {{ dayLabel(pr.startedAt) }}
                            </span>
                        </div>
                        <span class="dash-pr-est mono">
                            {{ fmtWeight(pr.est1rm) }}
                            <span class="dash-pr-unit">kg est.</span>
                        </span>
                    </NuxtLink>
                </div>
                <div
                    v-else
                    class="dash-empty"
                >
                    Log some sets to start setting records.
                </div>
            </UiCard>
        </div>
    </div>
</template>
