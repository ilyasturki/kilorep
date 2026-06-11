<script setup lang="ts">
import type {
    SessionWithEntries,
    WorkoutWithEntries,
} from '~~/server/database/schema'

const [{ data: workouts, status, refresh }, { data: sessions }] =
    await Promise.all([
        useFetch<WorkoutWithEntries[]>('/api/workouts'),
        useFetch<SessionWithEntries[]>('/api/sessions'),
    ])

const toast = useToast()

// In-progress workouts first, then finished history. Each group already arrives
// newest-first from the API. Flatten each workout's entry tree into numbered
// glance rows (01..N across supersets) so the card shows what was trained at a
// glance instead of hiding it behind "Review".
const ordered = computed(() => {
    const all = workouts.value ?? []
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
        return { ...w, stats: workoutStats(w.entries), blocks }
    })
})

type GlanceExercise =
    (typeof ordered.value)[number]['blocks'][number]['exercises'][number]

// Top weight stands in for the working load; just the count when nothing's logged.
const exSummary = (ex: GlanceExercise) =>
    ex.top != null ?
        `${plural(ex.setCount, 'set')} · ${ex.top} kg`
    :   plural(ex.setCount, 'set')

const metaLine = (w: (typeof ordered.value)[number]) =>
    [
        plural(w.stats.exercises, 'exercise'),
        plural(w.stats.sets, 'set'),
        `${w.stats.volume.toLocaleString()} kg`,
    ].join(' · ')

// Resolved on the client only: relative labels depend on "now", so SSR renders
// the absolute date and the client swaps in "Today"/"Yesterday" after mount —
// no hydration mismatch, and the right day in the viewer's own timezone.
const now = ref<Date>()
onMounted(() => {
    now.value = new Date()
})
const dayLabel = (w: WorkoutWithEntries) =>
    now.value ? fmtRelativeDay(w.startedAt, now.value) : fmtDate(w.startedAt)

const sessionSummary = (s: SessionWithEntries) => {
    const count = s.entries.reduce((n, e) => n + e.exercises.length, 0)
    return plural(count, 'exercise')
}

const pickerOpen = ref(false)
const starting = ref(false)

async function startWorkout(sessionId: number) {
    starting.value = true
    try {
        const workout = await $fetch('/api/workouts', {
            method: 'POST',
            body: { sessionId },
        })
        pickerOpen.value = false
        await navigateTo(`/workouts/${workout.id}`)
    } catch (error: unknown) {
        toast.add({
            title: errorMessage(error, 'Could not start the workout'),
            color: 'error',
        })
    } finally {
        starting.value = false
    }
}

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
        <div class="mb-5 flex items-end justify-end gap-4">
            <button
                type="button"
                class="btn-primary"
                @click="pickerOpen = true"
            >
                <Icon
                    name="tabler:plus"
                    :size="16"
                />
                Start workout
            </button>
        </div>

        <div
            v-if="status === 'pending' && !workouts?.length"
            class="empty"
        >
            Loading…
        </div>
        <div
            v-else-if="!ordered.length"
            class="empty"
        >
            No workouts yet. Start one from a session template.
        </div>
        <div
            v-else
            class="space-y-4"
        >
            <div
                v-for="w in ordered"
                :key="w.id"
                class="card"
            >
                <div class="card-head">
                    <NuxtLink
                        :to="`/workouts/${w.id}`"
                        class="session-name"
                    >
                        {{ w.name }}
                    </NuxtLink>
                    <div class="flex items-center gap-2">
                        <span
                            class="tag tag--lg"
                            :class="{ 'tag--accent': !w.completed }"
                        >
                            {{ w.completed ? dayLabel(w) : 'In progress' }}
                        </span>
                        <button
                            type="button"
                            class="icon-btn sm icon-btn--danger"
                            aria-label="Delete workout"
                            @click="deleteTarget = w"
                        >
                            <Icon
                                name="tabler:trash"
                                :size="15"
                            />
                        </button>
                    </div>
                </div>

                <p class="wk-meta">{{ metaLine(w) }}</p>

                <div
                    v-if="w.blocks.length"
                    class="wk-glance"
                >
                    <div
                        v-for="(block, bi) in w.blocks"
                        :key="bi"
                        class="plan-block"
                        :class="{ 'plan-block--ss': block.isSuperset }"
                    >
                        <span
                            v-if="block.isSuperset"
                            class="ss-tag"
                        >
                            SUPERSET
                        </span>
                        <NuxtLink
                            v-for="ex in block.exercises"
                            :key="ex.key"
                            :to="`/exercises/${ex.exerciseId}`"
                            class="plan-ex plan-ex--link"
                        >
                            <span class="plan-ex-idx">{{ pad(ex.n) }}</span>
                            <span class="plan-ex-name">{{ ex.name }}</span>
                            <span class="plan-ex-target">{{
                                exSummary(ex)
                            }}</span>
                        </NuxtLink>
                    </div>
                </div>

                <div class="card-actions">
                    <NuxtLink
                        v-if="!w.completed"
                        :to="`/workouts/${w.id}`"
                        class="btn-primary"
                    >
                        <Icon
                            name="tabler:player-play-filled"
                            :size="16"
                        />
                        Resume
                    </NuxtLink>
                    <NuxtLink
                        v-else
                        :to="`/workouts/${w.id}`"
                        class="btn-ghost"
                    >
                        Review
                        <Icon
                            name="tabler:chevron-right"
                            :size="16"
                        />
                    </NuxtLink>
                </div>
            </div>
        </div>

        <!-- Template picker -->
        <UiModal
            v-model:open="pickerOpen"
            title="Start workout"
            description="Pick a session template to begin tracking."
        >
            <div
                v-if="!sessions?.length"
                class="empty"
            >
                No templates yet.
                <NuxtLink
                    to="/sessions"
                    class="kicker--accent"
                >
                    Create a session
                </NuxtLink>
                first.
            </div>
            <div
                v-else
                class="space-y-2"
            >
                <button
                    v-for="s in sessions"
                    :key="s.id"
                    type="button"
                    class="btn-ghost w-full justify-between"
                    :disabled="starting"
                    @click="startWorkout(s.id)"
                >
                    <span class="font-semibold">{{ s.name }}</span>
                    <span class="kicker">{{ sessionSummary(s) }}</span>
                </button>
            </div>
        </UiModal>

        <!-- Delete workout -->
        <UiModal
            :open="deleteTarget !== null"
            title="Delete workout"
            :description="`Delete “${deleteTarget?.name}”? This can't be undone.`"
            @update:open="(open) => !open && (deleteTarget = null)"
        >
            <template #footer>
                <button
                    type="button"
                    class="btn-ghost"
                    @click="deleteTarget = null"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-danger"
                    :disabled="deleting"
                    @click="confirmDelete"
                >
                    <Icon
                        name="tabler:trash"
                        :size="15"
                    />
                    {{ deleting ? 'Deleting…' : 'Delete' }}
                </button>
            </template>
        </UiModal>
    </div>
</template>
