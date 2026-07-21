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
        <!-- 7-day summary with week-over-week deltas. Stays three-up on phones,
             so the cards shrink instead of wrapping: a grouped volume figure
             ("124,500 kg") must not overflow its card. -->
        <div class="mb-6 grid grid-cols-3 gap-3 max-sm:gap-2">
            <UiCard
                v-for="m in METRICS"
                :key="m.key"
                class="flex flex-col gap-1.5 p-4 max-sm:px-3 max-sm:py-3.5"
            >
                <span
                    class="font-mono text-[9.5px] tracking-[0.16em] text-ink-3 max-sm:tracking-[0.06em]"
                >
                    {{ m.label }} · 7D
                </span>
                <span
                    class="mono text-[26px] font-semibold tracking-[-0.02em] max-sm:text-[18px]"
                >
                    {{ fmtVolume(data.summary.current[m.key]) }}
                    <span
                        v-if="m.unit"
                        class="text-body-sm font-medium text-ink-2 max-sm:text-[10px]"
                        >{{ m.unit }}</span
                    >
                </span>
                <!-- Week-over-week change; volt only for gains, muted otherwise
                     so the page keeps a single accent. -->
                <span
                    v-if="delta(m) !== null"
                    class="mono flex items-baseline gap-[5px] text-micro max-sm:gap-1 max-sm:text-[10px]"
                    :class="
                        delta(m)! > 0 ? 'text-accent-ink'
                        : delta(m)! < 0 ? 'text-ink-2'
                        : 'text-ink-3'
                    "
                >
                    {{ delta(m) === 0 ? 'No change' : deltaText(delta(m)!) }}
                    <span
                        v-if="delta(m) !== 0"
                        class="text-[10px] text-ink-3 max-sm:text-[9px]"
                        >vs prev 7d</span
                    >
                </span>
            </UiCard>
        </div>

        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <!-- Volume trend leads as a full-width headline. -->
            <UiCard class="min-w-0 lg:col-span-full">
                <UiCardHead class="mb-4">
                    <span class="kicker">Volume · last 8 weeks</span>
                </UiCardHead>
                <div class="relative h-[260px]">
                    <ClientOnly v-if="hasVolume">
                        <VolumeChart :points="volumePoints" />
                        <template #fallback>
                            <div class="h-full bg-surface-2" />
                        </template>
                    </ClientOnly>
                    <div
                        v-else
                        class="flex h-full items-center justify-center text-body text-ink-3"
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
                    <div class="mb-4 flex gap-7">
                        <div class="flex flex-col gap-1">
                            <span
                                class="mono text-[22px] font-semibold tracking-[-0.02em]"
                                >{{
                                    data.bodyweight.current != null ?
                                        fmtFixed2(data.bodyweight.current)
                                    :   '—'
                                }}</span
                            >
                            <span
                                class="font-mono text-[9.5px] tracking-[0.16em] text-ink-3"
                                >Current · kg</span
                            >
                        </div>
                        <div class="flex flex-col gap-1">
                            <span
                                class="mono text-[22px] font-semibold tracking-[-0.02em]"
                                >{{
                                    data.bodyweight.change == null ?
                                        '—'
                                    :   fmtSigned2(data.bodyweight.change)
                                }}</span
                            >
                            <span
                                class="font-mono text-[9.5px] tracking-[0.16em] text-ink-3"
                                >Change · 30d</span
                            >
                        </div>
                    </div>
                    <div class="relative h-[180px]">
                        <ClientOnly>
                            <WeightChart
                                :points="weightPoints"
                                time-unit="day"
                            />
                            <template #fallback>
                                <div class="h-full bg-surface-2" />
                            </template>
                        </ClientOnly>
                    </div>
                </template>
                <div
                    v-else
                    class="py-2 text-body text-ink-3"
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
                    class="py-2 text-body text-ink-3"
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
                        class="font-mono text-[10.5px] tracking-[0.12em] text-ink-3 uppercase hover:text-accent-ink"
                        >All</NuxtLink
                    >
                </UiCardHead>
                <div
                    v-if="data.recentWorkouts.length"
                    class="flex flex-col"
                >
                    <NuxtLink
                        v-for="w in data.recentWorkouts"
                        :key="w.id"
                        :to="`/workouts/${w.id}`"
                        class="group/dash-row flex items-center justify-between gap-3 border-t border-t-line py-3 first:border-t-0"
                    >
                        <div class="flex min-w-0 flex-col gap-[3px]">
                            <span
                                class="truncate text-body font-semibold text-ink group-hover/dash-row:text-accent-ink"
                                >{{ w.name }}</span
                            >
                            <span class="font-mono text-micro text-ink-3">
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
                    class="py-2 text-body text-ink-3"
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
                    class="flex flex-col"
                >
                    <NuxtLink
                        v-for="pr in data.prs"
                        :key="pr.exerciseId"
                        :to="`/exercises/${pr.exerciseId}`"
                        class="group/dash-row flex items-center justify-between gap-3 border-t border-t-line py-3 first:border-t-0"
                    >
                        <div class="flex min-w-0 flex-col gap-[3px]">
                            <span
                                class="truncate text-body font-semibold text-ink group-hover/dash-row:text-accent-ink"
                                >{{ pr.name }}</span
                            >
                            <span class="font-mono text-micro text-ink-3">
                                {{ fmtWeight(pr.weight) }}
                                {{ weightUnit(pr.loadMode) }} × {{ pr.reps }} ·
                                {{ dayLabel(pr.startedAt) }}
                            </span>
                        </div>
                        <span
                            class="mono text-[16px] font-semibold whitespace-nowrap text-ink"
                        >
                            {{ fmtWeight(pr.est1rm) }}
                            <span
                                class="ml-0.5 text-[10px] font-medium text-ink-3"
                                >{{ weightUnit(pr.loadMode) }} est.</span
                            >
                        </span>
                    </NuxtLink>
                </div>
                <div
                    v-else
                    class="py-2 text-body text-ink-3"
                >
                    Log some sets to start setting records.
                </div>
            </UiCard>
        </div>
    </div>
</template>
