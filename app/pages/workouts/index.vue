<script setup lang="ts">
import type { WorkoutWithEntries } from '~~/server/database/schema'

const { workouts, loading, refresh } = useActiveWorkout()

const toast = useToast()
const invalidate = usePayloadCache()

// Display density, remembered per device (web-only, never sent to the server).
const VIEWS = ['detailed', 'condensed', 'calendar'] as const
const view = useLocalStorage<(typeof VIEWS)[number]>(
    'workouts-view',
    'detailed',
)

// In-progress workouts first, then finished history. Each group already arrives
// newest-first from the API. Flatten each workout's entry tree into numbered
// glance rows (01..N across supersets) so the card shows what was trained at a
// glance instead of hiding it behind "Review".
const ordered = computed(() => {
    const all = workouts.value ?? []
    // The entry tree already embeds each exercise row, muscles included — no
    // need for the catalog fetch the other pages use.
    const muscleById = new Map(
        all.flatMap((w) =>
            w.entries.flatMap((e) =>
                e.exercises.map(
                    (ex) => [ex.exerciseId, ex.exercise.muscles] as const,
                ),
            ),
        ),
    )
    return [
        ...all.filter((w) => !w.completed),
        ...all.filter((w) => w.completed),
    ].map((w) => {
        let n = 0
        const blocks = w.entries.map((entry) => ({
            isSuperset: entry.exercises.length > 1,
            exercises: entry.exercises.map((ex) => {
                const weights = ex.sets
                    .map((s) => s.weight)
                    .filter((x): x is number => x != null)
                return {
                    key: ex.id,
                    exerciseId: ex.exerciseId,
                    name: ex.exercise.name,
                    setCount: ex.sets.length,
                    top: weights.length ? Math.max(...weights) : null,
                    n: ++n,
                }
            }),
        }))
        return {
            ...w,
            stats: workoutStats(w.entries),
            blocks,
            muscles: topMuscles(w.entries, muscleById),
        }
    })
})

type GlanceExercise =
    (typeof ordered.value)[number]['blocks'][number]['exercises'][number]

// Top weight stands in for the working load; just the count when nothing's logged.
const exSummary = (ex: GlanceExercise) =>
    ex.top != null ?
        `${plural(ex.setCount, 'set')} · ${fmtWeight(ex.top)} kg`
    :   plural(ex.setCount, 'set')

const metaLine = (w: (typeof ordered.value)[number]) =>
    [
        plural(w.stats.exercises, 'exercise'),
        plural(w.stats.sets, 'set'),
        `${fmtVolume(w.stats.volume)} kg`,
    ].join(' · ')

// Compact two-stat summary for the condensed line.
const countLabel = (w: (typeof ordered.value)[number]) =>
    `${plural(w.stats.exercises, 'exercise')} · ${plural(w.stats.sets, 'set')}`

// Resolved on the client only: relative labels depend on "now", so SSR renders
// the absolute date and the client swaps in "Today"/"Yesterday" after mount —
// no hydration mismatch, and the right day in the viewer's own timezone.
const now = ref<Date>()
onMounted(() => {
    now.value = new Date()
})
const dayLabel = (w: WorkoutWithEntries) =>
    now.value ? fmtRelativeDay(w.startedAt, now.value) : fmtDate(w.startedAt)

const deleteTarget = ref<WorkoutWithEntries | null>(null)
const deleting = ref(false)

async function confirmDelete() {
    if (!deleteTarget.value) return
    deleting.value = true
    try {
        await $fetch(`/api/workouts/${deleteTarget.value.id}`, {
            method: 'DELETE',
        })
        deleteTarget.value = null
        invalidate(PAYLOAD.dashboard)
        await refresh()
        toast.add({ title: 'Workout deleted', color: 'success' })
    } catch (error: unknown) {
        toast.add({
            title: errorMessage(error, 'Could not delete the workout'),
            color: 'error',
        })
    } finally {
        deleting.value = false
    }
}
</script>

<template>
    <div>
        <div class="mb-5 flex items-center gap-4 view-bar">
            <UiSegmented
                v-if="ordered.length"
                stretch
            >
                <UiSegmentedOption
                    v-for="opt in VIEWS"
                    :key="opt"
                    type="button"
                    :active="view === opt"
                    @click="view = opt"
                >
                    {{ opt }}
                </UiSegmentedOption>
            </UiSegmented>
            <div class="ml-auto">
                <WorkoutStartButton variant="page" />
            </div>
        </div>

        <UiEmpty v-if="loading"> Loading… </UiEmpty>
        <UiEmpty v-else-if="!ordered.length">
            No workouts yet. Start one from a session template.
        </UiEmpty>
        <WorkoutCalendar
            v-else-if="view === 'calendar'"
            :workouts="workouts"
        />
        <div
            v-else
            :class="view === 'condensed' ? 'space-y-2' : 'space-y-4'"
        >
            <div
                v-for="w in ordered"
                :key="w.id"
                :class="
                    view === 'condensed' ?
                        'flex items-center justify-between gap-3 border border-line-2 bg-surface px-4.5 py-3.25'
                    :   'border border-line-2 bg-surface p-6'
                "
            >
                <!-- Condensed: one scannable line per workout -->
                <template v-if="view === 'condensed'">
                    <div class="flex min-w-0 items-center gap-2.5">
                        <NuxtLink
                            :to="`/workouts/${w.id}`"
                            class="min-w-0 max-w-full truncate text-[16px] font-bold tracking-[-0.02em] capitalize"
                        >
                            {{ w.name }}
                        </NuxtLink>
                        <UiTag :accent="!w.completed">
                            {{ w.completed ? dayLabel(w) : 'In progress' }}
                        </UiTag>
                        <span
                            class="font-mono text-micro font-semibold tracking-[0.04em] whitespace-nowrap text-ink-3 max-[479px]:hidden"
                            >{{ countLabel(w) }}</span
                        >
                    </div>
                    <UiIconButton
                        type="button"
                        size="sm"
                        tone="danger"
                        class="shrink-0"
                        aria-label="Delete workout"
                        @click="deleteTarget = w"
                    >
                        <Icon
                            name="tabler:trash"
                            :size="15"
                        />
                    </UiIconButton>
                </template>

                <template v-else>
                    <UiCardHead>
                        <NuxtLink
                            :to="`/workouts/${w.id}`"
                            class="text-[22px] font-extrabold tracking-[-0.02em] capitalize"
                        >
                            {{ w.name }}
                        </NuxtLink>
                        <div class="flex items-center gap-2">
                            <UiTag
                                size="lg"
                                :accent="!w.completed"
                            >
                                {{ w.completed ? dayLabel(w) : 'In progress' }}
                            </UiTag>
                            <UiIconButton
                                type="button"
                                size="sm"
                                tone="danger"
                                aria-label="Delete workout"
                                @click="deleteTarget = w"
                            >
                                <Icon
                                    name="tabler:trash"
                                    :size="15"
                                />
                            </UiIconButton>
                        </div>
                    </UiCardHead>

                    <TopMuscles
                        :muscles="w.muscles"
                        class="mt-3"
                    />

                    <p class="wk-meta">{{ metaLine(w) }}</p>

                    <div
                        v-if="w.blocks.length"
                        class="wk-glance"
                    >
                        <UiPlanBlock
                            v-for="(block, bi) in w.blocks"
                            :key="bi"
                            :superset="block.isSuperset"
                        >
                            <UiPlanExercise
                                v-for="ex in block.exercises"
                                :key="ex.key"
                                :to="`/exercises/${ex.exerciseId}`"
                                :index="pad(ex.n)"
                                :name="ex.name"
                                :target="exSummary(ex)"
                            />
                        </UiPlanBlock>
                    </div>

                    <UiCardActions>
                        <UiButton
                            v-if="!w.completed"
                            as-child
                            class="flex-1"
                        >
                            <NuxtLink :to="`/workouts/${w.id}`">
                                <Icon
                                    name="tabler:player-play-filled"
                                    :size="16"
                                />
                                Resume
                            </NuxtLink>
                        </UiButton>
                        <UiButton
                            v-else
                            tone="ghost"
                            as-child
                            class="flex-1"
                        >
                            <NuxtLink :to="`/workouts/${w.id}`">
                                Review
                                <Icon
                                    name="tabler:chevron-right"
                                    :size="16"
                                />
                            </NuxtLink>
                        </UiButton>
                    </UiCardActions>
                </template>
            </div>
        </div>

        <!-- Delete workout -->
        <UiModal
            :open="deleteTarget !== null"
            title="Delete workout"
            :description="`Delete “${deleteTarget?.name}”? This can't be undone.`"
            @update:open="(open) => !open && (deleteTarget = null)"
        >
            <template #footer>
                <UiButton
                    type="button"
                    tone="ghost"
                    @click="deleteTarget = null"
                >
                    Cancel
                </UiButton>
                <UiButton
                    type="button"
                    tone="danger"
                    :disabled="deleting"
                    @click="confirmDelete"
                >
                    <Icon
                        name="tabler:trash"
                        :size="15"
                    />
                    {{ deleting ? 'Deleting…' : 'Delete' }}
                </UiButton>
            </template>
        </UiModal>
    </div>
</template>
