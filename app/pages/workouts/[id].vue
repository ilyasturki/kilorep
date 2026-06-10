<script setup lang="ts">
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
const editing = ref(!workout.value?.completed)

// Drive the global topbar with the session name + status instead of "Workouts".
// usePageHeader owns the client-only watch + reset.
usePageHeader(() => {
    if (!workout.value) return null
    return {
        title: workout.value.name,
        tag: {
            label: editing.value ? 'In progress' : 'Completed',
            accent: editing.value,
        },
        back: '/workouts',
    }
})

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

const fmtWeight = (w: number | undefined | null) =>
    w == null ? '—' : `${w} kg`
const exVolume = (ex: ExerciseDraft) => setVolume(ex.sets)

// The workout's day is editable anytime (even once completed). Only the calendar
// day moves: the original time-of-day is kept so same-day ordering is stable.
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
        done: true,
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

// Confirm before dropping an exercise — a stray tap on the X would otherwise
// wipe all its logged sets with no undo.
const removeTarget = ref<{
    entryIndex: number
    exIndex: number
    name: string
}>()
function promptRemove(entryIndex: number, exIndex: number, name: string) {
    removeTarget.value = { entryIndex, exIndex, name }
}
function confirmRemove() {
    if (!removeTarget.value) return
    removeExercise(removeTarget.value.entryIndex, removeTarget.value.exIndex)
    removeTarget.value = undefined
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
                sets: [{ reps: 8, weight: undefined, done: true }],
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

// Persist the whole workout and sync the returned row back, so the date stat
// reflects any day shift the server applied.
async function persist(completed: boolean, opts?: { keepalive?: boolean }) {
    const updated = await $fetch<Workout>(`/api/workouts/${id}`, {
        method: 'PUT',
        body: buildBody(completed),
        keepalive: opts?.keepalive,
    })
    if (workout.value) {
        workout.value.startedAt = updated.startedAt
        workout.value.completed = updated.completed
        dateValue.value = toDateInput(updated.startedAt)
    }
    return updated
}

// Serialize writes so a debounced autosave landing right as the lifter hits
// Finish can't commit after it and silently clear the completed flag.
let chain: Promise<unknown> = Promise.resolve()
function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = chain.then(task, task)
    chain = run.catch(() => {})
    return run
}

// Auto-save replaces the old save button: edits persist on their own ~1s after
// they settle, silently. Explicit actions (finish/reopen/date) cancel a pending
// save and supersede it; only errors surface, as a toast.
let saveTimer: ReturnType<typeof setTimeout> | undefined
function cancelSave() {
    clearTimeout(saveTimer)
    saveTimer = undefined
}
function scheduleSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
        saveTimer = undefined
        enqueue(() => persist(false)).catch((error: unknown) => {
            toast.add({
                title: errorMessage(error, 'Could not save the workout'),
                color: 'error',
            })
        })
    }, 1000)
}

watch(
    draft,
    () => {
        if (editing.value) scheduleSave()
    },
    { deep: true },
)

// Don't lose the last edit when leaving before the debounce fires.
onBeforeRouteLeave(async () => {
    if (!saveTimer) return
    cancelSave()
    await enqueue(() => persist(false)).catch(() => {})
})
useEventListener('beforeunload', () => {
    if (!saveTimer) return
    // keepalive lets the flush outlive the page on a hard close/refresh.
    persist(false, { keepalive: true }).catch(() => {})
})

async function finish() {
    cancelSave()
    saving.value = true
    try {
        await enqueue(() => persist(true))
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
    cancelSave()
    saving.value = true
    try {
        await enqueue(() => persist(false))
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
    cancelSave()
    saving.value = true
    try {
        // Saves silently like the rest of the workout — no confirmation toast;
        // only a failure (below) surfaces.
        await enqueue(() => persist(!editing.value))
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
        <div class="wk-stats mb-8">
            <UiDatePicker
                v-model="dateValue"
                :max="today"
                :disabled="saving"
                aria-label="Workout date"
                @update:model-value="changeDate"
            />
            <div class="wk-stat">
                <span class="stat-num mono">{{ totals.volume }}</span>
                <span class="stat-lab">VOLUME · KG</span>
            </div>
            <div class="wk-stat">
                <span class="stat-num mono">{{ totals.sets }}</span>
                <span class="stat-lab">SETS</span>
            </div>
        </div>

        <div class="wk-actions">
            <button
                v-if="editing"
                type="button"
                class="btn-primary"
                :disabled="saving"
                @click="finish"
            >
                <Icon
                    name="tabler:check"
                    :size="16"
                />
                Finish workout
            </button>
            <button
                v-else
                type="button"
                class="btn-ghost"
                :disabled="saving"
                @click="reopen"
            >
                <Icon
                    name="tabler:pencil"
                    :size="15"
                />
                Reopen to edit
            </button>
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
                                <NuxtLink
                                    :to="`/exercises/${item.ex.exerciseId}`"
                                    class="wk-ex-name wk-ex-name--link"
                                >
                                    <span class="plan-ex-idx mono">
                                        {{ pad(item.n) }}
                                    </span>
                                    {{ item.ex.name }}
                                </NuxtLink>
                                <button
                                    type="button"
                                    class="icon-btn sm icon-btn--danger"
                                    aria-label="Remove exercise"
                                    @click="
                                        promptRemove(
                                            block.entryIndex,
                                            item.exIndex,
                                            item.ex.name,
                                        )
                                    "
                                >
                                    <Icon
                                        name="tabler:x"
                                        :size="15"
                                    />
                                </button>
                            </div>

                            <div class="logset logset-head">
                                <span />
                                <span class="set-lab">KG</span>
                                <span class="set-lab">REPS</span>
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
                                    class="icon-btn"
                                    aria-label="Remove set"
                                    :disabled="item.ex.sets.length <= 1"
                                    @click="removeSet(item.ex, si)"
                                >
                                    <Icon
                                        name="tabler:minus"
                                        :size="15"
                                    />
                                </button>
                            </div>

                            <button
                                type="button"
                                class="btn-link mt-2"
                                @click="addSet(item.ex)"
                            >
                                <Icon
                                    name="tabler:plus"
                                    :size="14"
                                />
                                Add set
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
                <Icon
                    name="tabler:plus"
                    :size="15"
                />
                Add exercise
            </button>
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
                            <NuxtLink
                                :to="`/exercises/${item.ex.exerciseId}`"
                                class="wk-ex-name wk-ex-name--link"
                            >
                                <span class="plan-ex-idx mono">
                                    {{ pad(item.n) }}
                                </span>
                                {{ item.ex.name }}
                            </NuxtLink>
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
                                <Icon
                                    name="tabler:check"
                                    :size="15"
                                />
                            </span>
                        </div>
                    </div>
                </div>
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
                    <Icon
                        name="tabler:plus"
                        :size="16"
                    />
                    Add
                </button>
            </template>
        </UiModal>

        <!-- Remove exercise -->
        <UiModal
            :open="removeTarget != null"
            title="Remove exercise"
            :description="`Remove ${removeTarget?.name ?? 'this exercise'} and all its sets from this workout?`"
            @update:open="(open) => !open && (removeTarget = undefined)"
        >
            <template #footer>
                <button
                    type="button"
                    class="btn-ghost"
                    @click="removeTarget = undefined"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-danger"
                    @click="confirmRemove"
                >
                    <Icon
                        name="tabler:trash"
                        :size="16"
                    />
                    Remove
                </button>
            </template>
        </UiModal>
    </div>
</template>
