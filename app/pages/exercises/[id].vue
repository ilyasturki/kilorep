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
        <div class="empty">
            Exercise not found.
            <NuxtLink
                to="/exercises"
                class="kicker--accent"
            >
                Back to exercises
            </NuxtLink>
        </div>
    </div>
    <div v-else>
        <div class="xtags">
            <span class="tag">{{ detail.equipment }}</span>
        </div>

        <!-- How to -->
        <section class="detail-section">
            <span class="kicker">How to</span>
            <a
                class="video-card"
                :href="videoUrl"
                target="_blank"
                rel="noopener noreferrer"
            >
                <span class="video-play">
                    <Icon
                        name="tabler:player-play-filled"
                        :size="22"
                    />
                </span>
                <span class="video-meta">
                    <span class="video-title">{{ detail.name }}</span>
                    <span class="kicker">Watch form tutorials on YouTube</span>
                </span>
                <Icon
                    name="tabler:external-link"
                    class="video-ext"
                    :size="16"
                />
            </a>
        </section>

        <!-- Muscles worked -->
        <section class="detail-section">
            <span class="kicker">Muscles worked</span>
            <MuscleMap :muscles="detail.muscles" />
            <div class="mm-legend">
                <span class="mm-legend-item">
                    <span class="mm-swatch mm-swatch--high" /> Prime mover
                </span>
                <span class="mm-legend-item">
                    <span class="mm-swatch mm-swatch--med" /> Secondary
                </span>
                <span class="mm-legend-item">
                    <span class="mm-swatch mm-swatch--low" /> Assists
                </span>
            </div>
            <div class="xmuscles mt-4">
                <span
                    v-for="m in sortedMuscles(detail.muscles)"
                    :key="m.muscle"
                    class="badge"
                    :class="`badge--${intensityVariant[m.intensity]}`"
                    :title="`${m.muscle} — ${m.intensity} intensity`"
                >
                    {{ m.muscle }}
                </span>
            </div>
        </section>

        <!-- History & personal best -->
        <section class="detail-section">
            <span class="kicker">History</span>
            <div class="wk-stats mb-5">
                <div class="wk-stat">
                    <span class="stat-num mono">
                        {{
                            detail.best ?
                                `${detail.best.weight}×${detail.best.reps}`
                            :   '—'
                        }}
                    </span>
                    <span class="stat-lab">BEST SET · KG</span>
                </div>
                <div class="wk-stat">
                    <span class="stat-num mono">{{
                        detail.history.length
                    }}</span>
                    <span class="stat-lab">WORKOUTS</span>
                </div>
                <div
                    v-if="detail.history.length"
                    class="wk-stat"
                >
                    <span class="stat-num mono">
                        {{ fmtDateShort(detail.history[0]!.startedAt) }}
                    </span>
                    <span class="stat-lab">LAST DONE</span>
                </div>
            </div>

            <div
                v-if="detail.history.length"
                class="card"
            >
                <div
                    v-for="w in detail.history"
                    :key="w.workoutId"
                    class="hist-row"
                >
                    <NuxtLink
                        :to="`/workouts/${w.workoutId}`"
                        class="hist-date"
                    >
                        {{ fmtDate(w.startedAt) }}
                    </NuxtLink>
                    <div class="hist-sets">
                        <span
                            v-for="(s, si) in w.sets"
                            :key="si"
                            class="set-chip"
                            :class="{ 'set-chip--off': !s.done }"
                        >
                            {{ s.weight == null ? '—' : s.weight
                            }}<span class="x">×</span>{{ s.reps }}
                        </span>
                    </div>
                </div>
            </div>
            <div
                v-else
                class="empty"
            >
                No logged sets yet — this exercise hasn't appeared in a workout.
            </div>
        </section>

        <!-- Programmed in -->
        <section class="detail-section">
            <span class="kicker">Programmed in</span>
            <div
                v-if="detail.sessions.length"
                class="sess-chips"
            >
                <NuxtLink
                    v-for="s in detail.sessions"
                    :key="s.id"
                    to="/sessions"
                    class="chip-link"
                >
                    {{ s.name }}
                </NuxtLink>
            </div>
            <div
                v-else
                class="empty"
            >
                Not part of any session template yet.
            </div>
        </section>
    </div>
</template>
