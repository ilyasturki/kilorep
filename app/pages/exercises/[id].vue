<script setup lang="ts">
import type { ExerciseDetail } from '~~/server/database/schema'

const route = useRoute()
const id = Number(route.params.id)

const { data: detail } = await useFetch<ExerciseDetail>(`/api/exercises/${id}`)

// Drive the topbar title + back link (and the browser tab title) instead of the
// route-derived "Exercises". usePageHeader owns the client-only watch + reset.
usePageHeader(() => {
    if (!detail.value) return null
    return {
        title: detail.value.name,
        tag: {
            label: detail.value.type,
            accent: detail.value.type === 'compound',
        },
        back: '/exercises',
    }
})

// No video is stored per exercise — open a YouTube search for the movement so
// any exercise, including ones the user adds, has a demo a tap away.
const videoUrl = computed(
    () =>
        `https://www.youtube.com/results?search_query=${encodeURIComponent(
            `${detail.value?.name ?? ''} proper form technique`,
        )}`,
)
</script>

<template>
    <div v-if="!detail">
        <UiEmpty>
            Exercise not found.
            <NuxtLink
                to="/exercises"
                class="text-accent-ink"
            >
                Back to exercises
            </NuxtLink>
        </UiEmpty>
    </div>
    <div v-else>
        <!-- Wide screens split into a reference column (illustration, how-to,
             muscles) and a data column (history, programmed-in); phones stay a
             single stacked column. Vertical rhythm comes from each section's own
             top margin, so the grid only owns the column gap. -->
        <div
            class="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-x-10 lg:gap-y-0"
        >
            <div class="flex min-w-0 flex-col">
                <div class="flex flex-wrap gap-[7px]">
                    <UiTag>{{ detail.equipment }}</UiTag>
                    <UiTag
                        v-if="detail.loadMode !== 'total'"
                        :title="`Logged kilograms are ${LOAD_MODE_LABELS[detail.loadMode]}`"
                    >
                        kg {{ LOAD_MODE_LABELS[detail.loadMode] }}
                    </UiTag>
                    <span
                        v-if="detail.source === 'custom'"
                        class="inline-flex items-center text-ink-3"
                        role="img"
                        aria-label="Custom exercise"
                        title="Custom exercise"
                    >
                        <Icon
                            name="tabler:user"
                            :size="16"
                        />
                    </span>
                </div>
                <p
                    v-if="detail.aliases.length"
                    class="mt-2.5 text-body-sm text-ink-3"
                >
                    Also known as {{ detail.aliases.join(', ') }}
                </p>

                <ExerciseIllustration :name="detail.name" />

                <!-- Muscles worked -->
                <section class="mt-[30px] lg:first:mt-0">
                    <span class="kicker mb-3 block">Muscles worked</span>
                    <MuscleMap :muscles="detail.muscles" />
                    <div class="mt-4 flex flex-wrap gap-x-4 gap-y-2">
                        <span
                            class="inline-flex items-center gap-[7px] text-[12.5px] text-ink-2"
                        >
                            <span
                                class="size-3 flex-none border border-transparent bg-accent"
                            />
                            Prime mover
                        </span>
                        <span
                            class="inline-flex items-center gap-[7px] text-[12.5px] text-ink-2"
                        >
                            <span
                                class="size-3 flex-none border border-muscle-med-edge bg-muscle-med"
                            />
                            Secondary
                        </span>
                        <span
                            class="inline-flex items-center gap-[7px] text-[12.5px] text-ink-2"
                        >
                            <span
                                class="size-3 flex-none border border-line-2 bg-muscle-low"
                            />
                            Assists
                        </span>
                    </div>
                    <div class="mt-4 flex flex-wrap gap-1.5">
                        <UiBadge
                            v-for="m in sortedMuscles(detail.muscles)"
                            :key="m.muscle"
                            :variant="intensityVariant[m.intensity]"
                            :title="`${m.muscle} — ${m.intensity} intensity`"
                        >
                            {{ m.muscle }}
                        </UiBadge>
                    </div>
                </section>

                <!-- How to -->
                <section class="mt-[30px] lg:first:mt-0">
                    <span class="kicker mb-3 block">How to</span>
                    <a
                        class="flex items-center gap-[15px] border border-line-2 bg-surface px-[17px] py-[15px] text-ink no-underline transition-[border-color] duration-[120ms] hover:border-accent"
                        :href="videoUrl"
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        <span
                            class="inline-flex size-[46px] flex-none items-center justify-center bg-accent text-on-accent"
                        >
                            <Icon
                                name="tabler:player-play-filled"
                                :size="22"
                            />
                        </span>
                        <span class="flex min-w-0 flex-col gap-[5px]">
                            <span class="text-[16px] font-bold capitalize">{{
                                detail.name
                            }}</span>
                            <span class="kicker"
                                >Watch form tutorials on YouTube</span
                            >
                        </span>
                        <Icon
                            name="tabler:external-link"
                            class="ml-auto flex-none text-ink-3"
                            :size="16"
                        />
                    </a>
                </section>
            </div>
            <div class="flex min-w-0 flex-col">
                <!-- Programmed in -->
                <section class="mt-[30px] lg:first:mt-0">
                    <span class="kicker mb-3 block">Programmed in</span>
                    <div
                        v-if="detail.sessions.length"
                        class="flex flex-wrap gap-2"
                    >
                        <NuxtLink
                            v-for="s in detail.sessions"
                            :key="s.id"
                            to="/sessions"
                            class="inline-flex items-center border border-line-2 bg-surface-2 px-3 py-[7px] text-body-sm font-semibold text-ink no-underline capitalize transition-[border-color] duration-[120ms] hover:border-accent"
                        >
                            {{ s.name }}
                        </NuxtLink>
                    </div>
                    <UiEmpty v-else>
                        Not part of any session template yet.
                    </UiEmpty>
                </section>

                <!-- History & personal best -->
                <section class="mt-[30px] lg:first:mt-0">
                    <span class="kicker mb-3 block">History</span>
                    <div
                        class="mb-5 flex flex-wrap items-center gap-x-7 gap-y-4"
                    >
                        <UiStat>
                            <template #value>
                                {{
                                    detail.best ?
                                        `${fmtWeight(detail.best.weight)}×${detail.best.reps}`
                                    :   '—'
                                }}
                            </template>
                            <template #label>
                                BEST SET ·
                                {{ weightUnit(detail.loadMode).toUpperCase() }}
                            </template>
                        </UiStat>
                        <UiStat>
                            <template #value>
                                {{ detail.history.length }}
                            </template>
                            <template #label>WORKOUTS</template>
                        </UiStat>
                        <UiStat v-if="detail.history.length">
                            <template #value>
                                {{ fmtDateShort(detail.history[0]!.startedAt) }}
                            </template>
                            <template #label>LAST DONE</template>
                        </UiStat>
                    </div>

                    <UiCard v-if="detail.history.length">
                        <div
                            v-for="w in detail.history"
                            :key="w.workoutId"
                            class="flex flex-wrap items-baseline gap-x-3.5 gap-y-[7px] border-t border-t-line py-[11px] first:border-t-0"
                        >
                            <NuxtLink
                                :to="`/workouts/${w.workoutId}`"
                                class="font-mono text-label whitespace-nowrap text-ink-2 no-underline transition-[color] duration-[120ms] hover:text-accent-ink"
                            >
                                {{ fmtDate(w.startedAt) }}
                            </NuxtLink>
                            <div class="flex flex-wrap gap-1.5">
                                <span
                                    v-for="(s, si) in w.sets"
                                    :key="si"
                                    class="border border-line bg-surface-2 px-2 py-[3px] font-mono text-label text-ink"
                                    ><span class="text-ink-3"
                                        >{{ si + 1 }} · </span
                                    >{{
                                        s.weight == null ?
                                            '—'
                                        :   fmtWeight(s.weight)
                                    }}<span class="mx-[3px] text-ink-3">×</span
                                    >{{ s.reps ?? '?' }}</span
                                >
                            </div>
                        </div>
                    </UiCard>
                    <UiEmpty v-else>
                        No logged sets yet — this exercise hasn't appeared in a
                        workout.
                    </UiEmpty>
                </section>
            </div>
        </div>
    </div>
</template>
