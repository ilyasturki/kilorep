<script setup lang="ts">
import { ChevronRight, Play, Plus, Trash2 } from 'lucide-vue-next'

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
// newest-first from the API.
const ordered = computed(() => {
    const all = workouts.value ?? []
    return [
        ...all.filter((w) => !w.completedAt),
        ...all.filter((w) => w.completedAt),
    ].map((w) => ({ ...w, stats: workoutStats(w.entries) }))
})

const fmtDate = (d: string | Date) =>
    new Date(d).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    })

const sessionSummary = (s: SessionWithEntries) => {
    const count = s.entries.reduce((n, e) => n + e.exercises.length, 0)
    return `${count} exercise${count === 1 ? '' : 's'}`
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
        <div class="mb-5 flex items-end justify-between gap-4">
            <span class="kicker">Log · {{ workouts?.length ?? 0 }}</span>
            <button
                type="button"
                class="btn-primary"
                @click="pickerOpen = true"
            >
                <Plus :size="16" /> Start workout
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
                            class="tag"
                            :class="{ 'tag--accent': !w.completedAt }"
                        >
                            {{
                                w.completedAt ?
                                    fmtDate(w.startedAt)
                                :   'In progress'
                            }}
                        </span>
                        <button
                            type="button"
                            class="icon-btn sm icon-btn--danger"
                            aria-label="Delete workout"
                            @click="deleteTarget = w"
                        >
                            <Trash2 :size="15" />
                        </button>
                    </div>
                </div>

                <div class="wk-stats">
                    <div class="wk-stat">
                        <span class="stat-num mono">{{
                            w.stats.exercises
                        }}</span>
                        <span class="stat-lab">EXERCISES</span>
                    </div>
                    <div class="wk-stat">
                        <span class="stat-num mono">{{ w.stats.sets }}</span>
                        <span class="stat-lab">SETS</span>
                    </div>
                    <div class="wk-stat">
                        <span class="stat-num mono">{{ w.stats.volume }}</span>
                        <span class="stat-lab">VOLUME · KG</span>
                    </div>
                </div>

                <div class="wk-actions">
                    <NuxtLink
                        v-if="!w.completedAt"
                        :to="`/workouts/${w.id}`"
                        class="btn-primary"
                    >
                        <Play :size="16" /> Resume
                    </NuxtLink>
                    <NuxtLink
                        v-else
                        :to="`/workouts/${w.id}`"
                        class="btn-ghost"
                    >
                        Review <ChevronRight :size="16" />
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
                    <Trash2 :size="15" />
                    {{ deleting ? 'Deleting…' : 'Delete' }}
                </button>
            </template>
        </UiModal>
    </div>
</template>
