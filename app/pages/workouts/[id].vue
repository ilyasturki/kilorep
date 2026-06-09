<script setup lang="ts">
import { Check, ChevronLeft, Minus, Pencil, Plus, X } from 'lucide-vue-next'

import type {
    Exercise,
    Workout,
    WorkoutWithEntries,
} from '~~/server/database/schema'

const route = useRoute()
const id = Number(route.params.id)
const toast = useToast()

const [{ data: workout }, { data: exercises }] = await Promise.all([
    useFetch<WorkoutWithEntries>(`/api/workouts/${id}`),
    useFetch<Exercise[]>('/api/exercises'),
])

type SetDraft = { reps: number; weight: number | undefined; done: boolean }
type ExerciseDraft = { exerciseId: number; name: string; sets: SetDraft[] }
type EntryDraft = { exercises: ExerciseDraft[] }

const draft = ref<EntryDraft[]>(
    (workout.value?.entries ?? []).map((entry) => ({
        exercises: entry.exercises.map((ex) => ({
            exerciseId: ex.exerciseId,
            name: ex.exercise.name,
            sets: ex.sets.map((s) => ({
                reps: s.reps,
                weight: s.weight ?? undefined,
                done: s.done,
            })),
        })),
    })),
)

// Edit when the workout is unfinished; review (read-only) once completed, until
// the lifter reopens it.
const editing = ref(!workout.value?.completedAt)

// Flatten to render blocks numbered 01..N across the whole workout, mirroring
// the session plan readout. The wrapped exercises keep their draft references so
// the set inputs stay two-way bound.
const blocks = computed(() => {
    let n = 0
    return draft.value.map((entry, entryIndex) => ({
        entryIndex,
        isSuperset: entry.exercises.length > 1,
        exercises: entry.exercises.map((ex, exIndex) => ({
            ex,
            exIndex,
            n: ++n,
        })),
    }))
})

const totals = computed(() => workoutStats(draft.value))

const duration = computed(() => {
    const w = workout.value
    if (!w?.completedAt) return null
    const ms =
        new Date(w.completedAt).getTime() - new Date(w.startedAt).getTime()
    return Math.max(0, Math.round(ms / 60000))
})

const pad = (n: number) => String(n).padStart(2, '0')
const fmtWeight = (w: number | undefined | null) =>
    w == null ? '—' : `${w} kg`
const exVolume = (ex: ExerciseDraft) => setVolume(ex.sets)

// The workout's day is editable anytime (even once completed). Only the calendar
// day moves: the original time-of-day is kept and the PUT shifts completedAt by
// the same delta, so a moved workout keeps its duration.
const toDateInput = (d: string | Date) => {
    const date = new Date(d)
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
const dateValue = ref(workout.value ? toDateInput(workout.value.startedAt) : '')
const today = toDateInput(new Date())

function composedStartedAt() {
    if (!dateValue.value || !workout.value) return undefined
    const [y, m, d] = dateValue.value.split('-')
    const startedAt = new Date(workout.value.startedAt)
    startedAt.setFullYear(Number(y), Number(m) - 1, Number(d))
    return startedAt.toISOString()
}

function addSet(ex: ExerciseDraft) {
    const last = ex.sets.at(-1)
    ex.sets.push({
        reps: last?.reps ?? 8,
        weight: last?.weight,
        done: false,
    })
}
function removeSet(ex: ExerciseDraft, index: number) {
    ex.sets.splice(index, 1)
}
function removeExercise(entryIndex: number, exIndex: number) {
    const entry = draft.value[entryIndex]
    if (!entry) return
    entry.exercises.splice(exIndex, 1)
    if (entry.exercises.length === 0) draft.value.splice(entryIndex, 1)
}

const exerciseItems = computed(() =>
    (exercises.value ?? []).map((e) => ({ label: e.name, value: e.id })),
)
const addOpen = ref(false)
const addExerciseId = ref<number>()

function confirmAdd() {
    const picked = exercises.value?.find((e) => e.id === addExerciseId.value)
    if (!picked) return
    draft.value.push({
        exercises: [
            {
                exerciseId: picked.id,
                name: picked.name,
                sets: [{ reps: 8, weight: undefined, done: false }],
            },
        ],
    })
    addExerciseId.value = undefined
    addOpen.value = false
}

function buildBody(completed: boolean) {
    return {
        completed,
        startedAt: composedStartedAt(),
        entries: draft.value.map((entry) => ({
            exercises: entry.exercises.map((ex) => ({
                exerciseId: ex.exerciseId,
                sets: ex.sets.map((s) => ({
                    reps: s.reps,
                    weight: s.weight ?? null,
                    done: s.done,
                })),
            })),
        })),
    }
}

const saving = ref(false)

// Persist the whole workout and sync the returned timestamps back, so the date
// stat and duration reflect any day shift the server applied.
async function persist(completed: boolean) {
    const updated = await $fetch<Workout>(`/api/workouts/${id}`, {
        method: 'PUT',
        body: buildBody(completed),
    })
    if (workout.value) {
        workout.value.startedAt = updated.startedAt
        workout.value.completedAt = updated.completedAt
        dateValue.value = toDateInput(updated.startedAt)
    }
    return updated
}

async function saveProgress() {
    saving.value = true
    try {
        await persist(false)
        toast.add({ title: 'Progress saved', color: 'success' })
    } catch (error: unknown) {
        toast.add({
            title: errorMessage(error, 'Could not save the workout'),
            color: 'error',
        })
    } finally {
        saving.value = false
    }
}

async function finish() {
    saving.value = true
    try {
        await persist(true)
        toast.add({ title: 'Workout finished', color: 'success' })
        await navigateTo('/workouts')
    } catch (error: unknown) {
        toast.add({
            title: errorMessage(error, 'Could not save the workout'),
            color: 'error',
        })
    } finally {
        saving.value = false
    }
}

async function reopen() {
    saving.value = true
    try {
        await persist(false)
        editing.value = true
        toast.add({ title: 'Workout reopened', color: 'success' })
    } catch (error: unknown) {
        toast.add({
            title: errorMessage(error, 'Could not reopen the workout'),
            color: 'error',
        })
    } finally {
        saving.value = false
    }
}

// The date saves on its own — it's metadata, editable in both modes without the
// review view needing a save button. Keep the current completed state.
async function changeDate() {
    saving.value = true
    try {
        await persist(!editing.value)
        toast.add({ title: 'Date updated', color: 'success' })
    } catch (error: unknown) {
        if (workout.value)
            dateValue.value = toDateInput(workout.value.startedAt)
        toast.add({
            title: errorMessage(error, 'Could not update the date'),
            color: 'error',
        })
    } finally {
        saving.value = false
    }
}
</script>

<template>
    <div v-if="!workout">
        <div class="empty">
            Workout not found.
            <NuxtLink
                to="/workouts"
                class="kicker--accent"
            >
                Back to workouts
            </NuxtLink>
        </div>
    </div>
    <div v-else>
        <NuxtLink
            to="/workouts"
            class="btn-link"
        >
            <ChevronLeft :size="14" /> Workouts
        </NuxtLink>

        <div class="card-head mt-3 items-start">
            <div>
                <h2 class="session-name">{{ workout.name }}</h2>
                <input
                    v-model="dateValue"
                    type="date"
                    class="date-input mt-2"
                    :max="today"
                    :disabled="saving"
                    aria-label="Workout date"
                    @change="changeDate"
                />
            </div>
            <span
                class="tag"
                :class="{ 'tag--accent': editing }"
            >
                {{ editing ? 'In progress' : 'Completed' }}
            </span>
        </div>

        <div class="wk-stats mb-8">
            <div class="wk-stat">
                <span class="stat-num mono">{{ totals.volume }}</span>
                <span class="stat-lab">VOLUME · KG</span>
            </div>
            <div class="wk-stat">
                <span class="stat-num mono">{{ totals.sets }}</span>
                <span class="stat-lab">SETS</span>
            </div>
            <div
                v-if="duration !== null"
                class="wk-stat"
            >
                <span class="stat-num mono">{{ duration }}</span>
                <span class="stat-lab">MINUTES</span>
            </div>
        </div>

        <!-- Tracking -->
        <template v-if="editing">
            <div class="space-y-3">
                <div
                    v-for="block in blocks"
                    :key="block.entryIndex"
                    class="builder-block"
                    :class="{ 'builder-block--ss': block.isSuperset }"
                >
                    <div
                        v-if="block.isSuperset"
                        class="mb-3"
                    >
                        <span class="tag tag--accent">Superset</span>
                    </div>

                    <div class="space-y-5">
                        <div
                            v-for="item in block.exercises"
                            :key="item.exIndex"
                        >
                            <div class="wk-ex-head">
                                <span class="wk-ex-name">
                                    <span class="plan-ex-idx mono">
                                        {{ pad(item.n) }}
                                    </span>
                                    {{ item.ex.name }}
                                </span>
                                <button
                                    type="button"
                                    class="icon-btn sm icon-btn--danger"
                                    aria-label="Remove exercise"
                                    @click="
                                        removeExercise(
                                            block.entryIndex,
                                            item.exIndex,
                                        )
                                    "
                                >
                                    <X :size="15" />
                                </button>
                            </div>

                            <div class="logset logset-head">
                                <span />
                                <span class="set-lab">KG</span>
                                <span class="set-lab">REPS</span>
                                <span />
                                <span />
                            </div>
                            <div
                                v-for="(set, si) in item.ex.sets"
                                :key="si"
                                class="logset"
                            >
                                <span class="set-lab">{{ si + 1 }}</span>
                                <UiNumberField
                                    v-model="set.weight"
                                    :min="0"
                                    :step="2.5"
                                />
                                <UiNumberField
                                    v-model="set.reps"
                                    :min="1"
                                />
                                <button
                                    type="button"
                                    class="set-done"
                                    :class="{ on: set.done }"
                                    :aria-label="
                                        set.done ? 'Set done' : 'Mark set done'
                                    "
                                    @click="set.done = !set.done"
                                >
                                    <Check :size="16" />
                                </button>
                                <button
                                    type="button"
                                    class="icon-btn sm"
                                    aria-label="Remove set"
                                    :disabled="item.ex.sets.length <= 1"
                                    @click="removeSet(item.ex, si)"
                                >
                                    <Minus :size="15" />
                                </button>
                            </div>

                            <button
                                type="button"
                                class="btn-link mt-2"
                                @click="addSet(item.ex)"
                            >
                                <Plus :size="14" /> Add set
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <button
                type="button"
                class="btn-ghost sm mt-3"
                @click="addOpen = true"
            >
                <Plus :size="15" /> Add exercise
            </button>

            <div class="wk-actions">
                <button
                    type="button"
                    class="btn-ghost"
                    :disabled="saving"
                    @click="saveProgress"
                >
                    {{ saving ? 'Saving…' : 'Save progress' }}
                </button>
                <button
                    type="button"
                    class="btn-primary"
                    :disabled="saving"
                    @click="finish"
                >
                    <Check :size="16" /> Finish workout
                </button>
            </div>
        </template>

        <!-- Review -->
        <template v-else>
            <div class="card">
                <div
                    v-for="block in blocks"
                    :key="block.entryIndex"
                    class="plan-block"
                    :class="{ 'plan-block--ss': block.isSuperset }"
                >
                    <span
                        v-if="block.isSuperset"
                        class="ss-tag"
                    >
                        SUPERSET
                    </span>
                    <div
                        v-for="item in block.exercises"
                        :key="item.exIndex"
                        class="mb-2"
                    >
                        <div class="wk-ex-head">
                            <span class="wk-ex-name">
                                <span class="plan-ex-idx mono">
                                    {{ pad(item.n) }}
                                </span>
                                {{ item.ex.name }}
                            </span>
                            <span class="kicker"
                                >{{ exVolume(item.ex) }} kg</span
                            >
                        </div>
                        <div
                            v-for="(set, si) in item.ex.sets"
                            :key="si"
                            class="logline"
                        >
                            <span class="set-lab">{{ si + 1 }}</span>
                            <span class="logline-load">
                                {{ fmtWeight(set.weight) }}
                                <span class="x">×</span>
                                {{ set.reps }}
                            </span>
                            <span
                                class="logline-check"
                                :class="{ skipped: !set.done }"
                            >
                                <Check :size="15" />
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="wk-actions">
                <button
                    type="button"
                    class="btn-ghost"
                    :disabled="saving"
                    @click="reopen"
                >
                    <Pencil :size="15" /> Reopen to edit
                </button>
            </div>
        </template>

        <!-- Add exercise -->
        <UiModal
            v-model:open="addOpen"
            title="Add exercise"
            description="Add an extra exercise to this workout."
        >
            <UiSelect
                v-model="addExerciseId"
                :items="exerciseItems"
                placeholder="Pick an exercise"
            />
            <template #footer>
                <button
                    type="button"
                    class="btn-ghost"
                    @click="addOpen = false"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-primary"
                    :disabled="!addExerciseId"
                    @click="confirmAdd"
                >
                    <Plus :size="16" /> Add
                </button>
            </template>
        </UiModal>
    </div>
</template>
