<script setup lang="ts">
import type {
    Exercise,
    Workout,
    WorkoutDetail,
    WorkoutTemplateStatus,
} from '~~/server/database/schema'
import type {
    WorkoutEntryDraft as EntryDraft,
    WorkoutExerciseDraft as ExerciseDraft,
} from '~/utils/workoutDraft'
import {
    addWorkoutSet,
    newWorkoutExercise,
    removeWorkoutExercise,
    removeWorkoutSet,
    ungroupWorkoutEntry,
    workoutDraftFromEntries,
    workoutDraftToBody,
} from '~/utils/workoutDraft'

const route = useRoute()
const id = Number(route.params.id)
const toast = useToast()

const [{ data: workout }, { data: exercises }] = await Promise.all([
    useFetch<WorkoutDetail>(`/api/workouts/${id}`),
    useFetch<Exercise[]>('/api/exercises'),
])

const draft = ref<EntryDraft[]>(
    workoutDraftFromEntries(workout.value?.entries ?? []),
)

// `completed` is the persisted status; `editing` is a pure view↔edit toggle,
// independent of it. A finished workout opens read-only and Edit flips `editing`
// without un-completing it, so editing never re-activates the workout.
const completed = ref(!!workout.value?.completed)
const editing = ref(!completed.value)

const { active, refresh: refreshActiveWorkout } = useActiveWorkout()
const invalidate = usePayloadCache()

// Resuming re-opens this workout while another is already in progress, breaking
// the single-active convention the Start CTA leans on. Block it then.
const resumeBlocked = computed(
    () => active.value != null && active.value.id !== id,
)

// The template link drives the sync-back strip. PUT responses refresh it, so
// the offer tracks the last autosaved tree (~1s behind the draft), never a
// stale page load.
const template = ref<WorkoutTemplateStatus>(workout.value?.template ?? null)

// Offer syncing when the structure drifted from the template; for an orphaned
// workout (template deleted) the structure may be worth keeping, so always.
const syncOffer = computed(() => {
    if (!draft.value.some((entry) => entry.exercises.length > 0)) return false
    return template.value ? template.value.diverged : true
})

// Drive the global topbar with the session name + status instead of "Workouts".
// usePageHeader owns the client-only watch + reset.
usePageHeader(() => {
    if (!workout.value) return null
    return {
        title: workout.value.name,
        tag: {
            label: completed.value ? 'Completed' : 'In progress',
            accent: !completed.value,
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
        entryId: entry.id,
        isSuperset: entry.exercises.length > 1,
        exercises: entry.exercises.map((ex, exIndex) => ({
            ex,
            exIndex,
            n: ++n,
        })),
    }))
})

const totals = computed(() => workoutStats(draft.value))

const exerciseMuscles = computed(() => musclesByExercise(exercises.value ?? []))
const topTargets = computed(() =>
    topMuscles(draft.value, exerciseMuscles.value),
)

const weightLabel = (w: number | undefined | null) =>
    w == null ? '—' : `${fmtWeight(w)} kg`
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
    addWorkoutSet(ex)
}
function removeSet(ex: ExerciseDraft, index: number) {
    removeWorkoutSet(ex, index)
}
function removeExercise(entryIndex: number, exIndex: number) {
    removeWorkoutExercise(draft.value, entryIndex, exIndex)
}

const exerciseById = (exId: number | undefined) =>
    exercises.value?.find((e) => e.id === exId)

// Adopt an inline-created exercise into the local catalog so the picker can
// resolve its label and keep it selected without a refetch.
function onExerciseCreated(exercise: Exercise) {
    exercises.value = [...(exercises.value ?? []), exercise]
}

// Swap which exercise an entry tracks (machine taken, equipment missing)
// while keeping its logged sets. The combobox starts on the current exercise,
// so Swap only enables once a different one is picked.
const swapTarget = ref<{ entryIndex: number; exIndex: number }>()
const swapSource = computed(() => {
    const target = swapTarget.value
    return target ?
            draft.value[target.entryIndex]?.exercises[target.exIndex]
        :   undefined
})
const swapExerciseId = ref<number>()
function promptSwap(entryIndex: number, exIndex: number) {
    const ex = draft.value[entryIndex]?.exercises[exIndex]
    if (!ex) return
    swapTarget.value = { entryIndex, exIndex }
    swapExerciseId.value = ex.exerciseId
}
function confirmSwap() {
    const ex = swapSource.value
    const picked = exerciseById(swapExerciseId.value)
    if (!ex || !picked) return
    ex.exerciseId = picked.id
    ex.name = picked.name
    swapTarget.value = undefined
}

// Confirm before dropping an exercise — a stray tap on the X would otherwise
// wipe all its logged sets with no undo. A fresh set starts blank, so any typed
// reps or weight is real data worth confirming; with none, skip the dialog.
const removeTarget = ref<{
    entryIndex: number
    exIndex: number
    name: string
}>()
function promptRemove(entryIndex: number, exIndex: number, name: string) {
    const ex = draft.value[entryIndex]?.exercises[exIndex]
    if (ex && !ex.sets.some((s) => s.weight != null || s.reps != null)) {
        removeExercise(entryIndex, exIndex)
        return
    }
    removeTarget.value = { entryIndex, exIndex, name }
}
function confirmRemove() {
    if (!removeTarget.value) return
    removeExercise(removeTarget.value.entryIndex, removeTarget.value.exIndex)
    removeTarget.value = undefined
}

const addOpen = ref(false)
const addExerciseId = ref<number>()

const newExerciseDraft = newWorkoutExercise

function confirmAdd() {
    const picked = exerciseById(addExerciseId.value)
    if (!picked) return
    draft.value.push({ id: uid(), exercises: [newExerciseDraft(picked)] })
    addExerciseId.value = undefined
    addOpen.value = false
}

// Blank picker rows are dropped on confirm, so an unused extra slot never
// blocks adding the superset.
const supersetOpen = ref(false)
const supersetIds = ref<(number | undefined)[]>([])
const supersetPicked = computed(() =>
    supersetIds.value
        .map((exId) => exerciseById(exId))
        .filter((e) => e != null),
)
function openAddSuperset() {
    supersetIds.value = [undefined, undefined]
    supersetOpen.value = true
}
function confirmAddSuperset() {
    if (supersetPicked.value.length < 2) return
    draft.value.push({
        id: uid(),
        exercises: supersetPicked.value.map(newExerciseDraft),
    })
    supersetOpen.value = false
}

// Grow a block into (or as) a superset by picking one more exercise for it.
// Only the entry index is state; the modal copy derives from the entry itself.
const addToTarget = ref<number>()
const addToEntry = computed(() =>
    addToTarget.value == null ? undefined : draft.value[addToTarget.value],
)
const addToExerciseId = ref<number>()
function promptAddTo(entryIndex: number) {
    if (!draft.value[entryIndex]?.exercises.length) return
    addToTarget.value = entryIndex
    addToExerciseId.value = undefined
}
function confirmAddTo() {
    const entry = addToEntry.value
    const picked = exerciseById(addToExerciseId.value)
    if (!entry || !picked) return
    entry.exercises.push(newExerciseDraft(picked))
    addToTarget.value = undefined
}

function ungroupEntry(entryIndex: number) {
    ungroupWorkoutEntry(draft.value, entryIndex)
}

function buildBody(isCompleted: boolean) {
    return workoutDraftToBody(draft.value, {
        completed: isCompleted,
        startedAt: composedStartedAt(),
    })
}

const saving = ref(false)

// Persist the whole workout and sync the returned row back, so the date stat
// reflects any day shift the server applied.
async function persist(nextCompleted: boolean, opts?: { keepalive?: boolean }) {
    const updated = await $fetch<Workout & { template: WorkoutTemplateStatus }>(
        `/api/workouts/${id}`,
        {
            method: 'PUT',
            body: buildBody(nextCompleted),
            keepalive: opts?.keepalive,
        },
    )
    if (workout.value) {
        workout.value.startedAt = updated.startedAt
        workout.value.completed = updated.completed
        dateValue.value = toDateInput(updated.startedAt)
    }
    completed.value = updated.completed
    template.value = updated.template
    // Every write here changes what the list and the dashboard would show —
    // volume, sets, PRs, the "in progress" grouping. Drop their cached payloads
    // so navigating away lands on the new numbers rather than the old ones.
    invalidate(PAYLOAD.workouts, PAYLOAD.dashboard)
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
// they settle, silently, preserving the current completed status. Explicit
// actions (finish/resume/date) cancel a pending save and supersede it; only
// errors surface, as a toast.
let saveTimer: ReturnType<typeof setTimeout> | undefined
function cancelSave() {
    clearTimeout(saveTimer)
    saveTimer = undefined
}
function scheduleSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
        saveTimer = undefined
        enqueue(() => persist(completed.value)).catch((error: unknown) => {
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
    await enqueue(() => persist(completed.value)).catch(() => {})
})
useEventListener('beforeunload', () => {
    if (!saveTimer) return
    // keepalive lets the flush outlive the page on a hard close/refresh.
    persist(completed.value, { keepalive: true }).catch(() => {})
})

async function finish() {
    cancelSave()
    saving.value = true
    try {
        await enqueue(() => persist(true))
        await refreshActiveWorkout()
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

const resumeOpen = ref(false)

// Resume genuinely re-opens a finished workout for more training: it clears
// `completed` (making it the active workout again) and drops into edit mode,
// unlike Edit which leaves the status untouched.
async function resume() {
    cancelSave()
    saving.value = true
    try {
        await enqueue(() => persist(false))
        editing.value = true
        resumeOpen.value = false
        await refreshActiveWorkout()
        toast.add({ title: 'Workout resumed', color: 'success' })
    } catch (error: unknown) {
        toast.add({
            title: errorMessage(error, 'Could not resume the workout'),
            color: 'error',
        })
    } finally {
        saving.value = false
    }
}

const updateOpen = ref(false)
const createOpen = ref(false)
const createName = ref('')
const diffOpen = ref(false)

// Render the server's itemised diff. Names come from the catalog (the change
// list is keyed by id), so a removed exercise no longer in the draft still
// resolves; an open rep target (null) reads as "open" rather than a blank.
type DiffRow = { sign: string; tone: 'add' | 'remove' | 'edit'; text: string }
const reps = (r: number | null) => (r == null ? 'open' : String(r))
const diffItems = computed<DiffRow[]>(() => {
    const name = (exId: number) => exerciseById(exId)?.name ?? 'Exercise'
    return (template.value?.changes ?? []).map((change): DiffRow => {
        switch (change.kind) {
            case 'added':
                return {
                    sign: '+',
                    tone: 'add',
                    text: `Added ${name(change.exerciseId)}`,
                }
            case 'removed':
                return {
                    sign: '−',
                    tone: 'remove',
                    text: `Removed ${name(change.exerciseId)}`,
                }
            case 'sets':
                return {
                    sign: '~',
                    tone: 'edit',
                    text: `${name(change.exerciseId)} · ${plural(change.count, 'set')} (was ${change.was})`,
                }
            case 'reps':
                return {
                    sign: '~',
                    tone: 'edit',
                    text: `${name(change.exerciseId)} set ${change.setIndex + 1} · ${reps(change.reps)} reps (was ${reps(change.was)})`,
                }
            case 'reordered':
                return {
                    sign: '~',
                    tone: 'edit',
                    text: 'Reordered or regrouped exercises',
                }
        }
    })
})
// Rep deltas are observational — Update keeps the template's prescriptions — so
// only footnote that when a rep row is actually on screen.
const hasRepDiff = computed(() =>
    (template.value?.changes ?? []).some((change) => change.kind === 'reps'),
)

function openCreate() {
    createName.value =
        template.value ?
            `${template.value.name} 2`
        :   (workout.value?.name ?? '')
    createOpen.value = true
}

// Save the workout's structure to a template: 'update' rewrites the source,
// 'create' makes a new one and re-points this workout at it. A pending
// autosave is flushed first so the server syncs the tree the lifter sees.
async function syncToSession(mode: 'update' | 'create') {
    saving.value = true
    try {
        if (saveTimer) {
            cancelSave()
            await enqueue(() => persist(completed.value))
        }
        const status = await enqueue(() =>
            $fetch<WorkoutTemplateStatus>(`/api/workouts/${id}/to-session`, {
                method: 'POST',
                body:
                    mode === 'create' ?
                        { mode, name: createName.value }
                    :   { mode },
            }),
        )
        template.value = status
        // Either mode writes a template, so the sessions list is now stale.
        invalidate(PAYLOAD.sessions)
        // Creating re-names the workout after its new template server-side;
        // mirror it so the topbar follows without a refetch. Replace the
        // object — useFetch data is a shallowRef, so a nested mutation
        // wouldn't reach the header watcher.
        if (mode === 'create' && status && workout.value) {
            workout.value = { ...workout.value, name: status.name }
        }
        updateOpen.value = false
        createOpen.value = false
        toast.add({
            title: mode === 'update' ? 'Session updated' : 'Session created',
            color: 'success',
        })
    } catch (error: unknown) {
        toast.add({
            title: errorMessage(error, 'Could not save the session'),
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
        await enqueue(() => persist(completed.value))
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
        <div class="mb-8 space-y-4">
            <div class="wk-stats">
                <UiDatePicker
                    v-model="dateValue"
                    :max="today"
                    :disabled="saving"
                    aria-label="Workout date"
                    @update:model-value="changeDate"
                />
                <div class="wk-stat">
                    <span class="stat-num mono">{{
                        fmtVolume(totals.volume)
                    }}</span>
                    <span class="stat-lab">VOLUME · KG</span>
                </div>
                <div class="wk-stat">
                    <span class="stat-num mono">{{ totals.sets }}</span>
                    <span class="stat-lab">SETS</span>
                </div>
            </div>
            <TopMuscles :muscles="topTargets" />
            <div
                v-if="syncOffer"
                class="wk-sync"
            >
                <Icon
                    name="tabler:git-fork"
                    :size="14"
                />
                <button
                    v-if="template"
                    type="button"
                    class="wk-sync-text wk-sync-text--btn"
                    @click="diffOpen = true"
                >
                    Differs from {{ template.name }}
                    <Icon
                        name="tabler:chevron-right"
                        :size="13"
                    />
                </button>
                <span
                    v-else
                    class="wk-sync-text"
                >
                    Not saved as a session
                </span>
                <button
                    v-if="template"
                    type="button"
                    class="btn-link"
                    :disabled="saving"
                    @click="updateOpen = true"
                >
                    Update
                </button>
                <button
                    type="button"
                    class="btn-link"
                    :disabled="saving"
                    @click="openCreate"
                >
                    {{ template ? 'Save as new' : 'Save as session' }}
                </button>
            </div>
        </div>

        <WorkoutActions
            v-model:editing="editing"
            :completed="completed"
            :saving="saving"
            :resume-blocked="resumeBlocked"
            @finish="finish"
            @resume="resumeOpen = true"
        />

        <!-- Tracking -->
        <template v-if="editing">
            <TransitionGroup
                name="reorder"
                tag="div"
                class="space-y-3"
            >
                <div
                    v-for="block in blocks"
                    :key="block.entryId"
                    class="builder-block"
                    :class="{ 'builder-block--ss': block.isSuperset }"
                >
                    <div
                        v-if="block.isSuperset"
                        class="mb-3 flex items-center justify-between"
                    >
                        <span class="tag tag--accent">Superset</span>
                        <div class="flex items-center gap-1">
                            <button
                                type="button"
                                class="icon-btn sm"
                                aria-label="Ungroup superset"
                                @click="ungroupEntry(block.entryIndex)"
                            >
                                <Icon
                                    name="tabler:unlink"
                                    :size="15"
                                />
                            </button>
                            <MoveButtons
                                label="superset"
                                :can-up="block.entryIndex > 0"
                                :can-down="block.entryIndex < draft.length - 1"
                                @move="
                                    (dir) =>
                                        moveItem(draft, block.entryIndex, dir)
                                "
                            />
                        </div>
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
                                <div class="flex items-center gap-1">
                                    <MoveButtons
                                        v-if="!block.isSuperset"
                                        label="exercise"
                                        :can-up="block.entryIndex > 0"
                                        :can-down="
                                            block.entryIndex < draft.length - 1
                                        "
                                        @move="
                                            (dir) =>
                                                moveItem(
                                                    draft,
                                                    block.entryIndex,
                                                    dir,
                                                )
                                        "
                                    />
                                    <button
                                        type="button"
                                        class="icon-btn sm"
                                        aria-label="Swap exercise"
                                        @click="
                                            promptSwap(
                                                block.entryIndex,
                                                item.exIndex,
                                            )
                                        "
                                    >
                                        <Icon
                                            name="tabler:switch-horizontal"
                                            :size="15"
                                        />
                                    </button>
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
                                    :step-snapping="false"
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

                    <button
                        type="button"
                        class="btn-link mt-3"
                        @click="promptAddTo(block.entryIndex)"
                    >
                        <Icon
                            name="tabler:link"
                            :size="14"
                        />
                        {{
                            block.isSuperset ?
                                'Add exercise to superset'
                            :   'Superset with another exercise'
                        }}
                    </button>
                </div>
            </TransitionGroup>

            <div class="mt-3 flex flex-wrap gap-2">
                <button
                    type="button"
                    class="btn-ghost sm"
                    @click="addOpen = true"
                >
                    <Icon
                        name="tabler:plus"
                        :size="15"
                    />
                    Add exercise
                </button>
                <button
                    type="button"
                    class="btn-ghost sm"
                    @click="openAddSuperset"
                >
                    <Icon
                        name="tabler:stack-2"
                        :size="15"
                    />
                    Add superset
                </button>
            </div>
        </template>

        <!-- Review -->
        <template v-else>
            <div class="card">
                <div
                    v-for="block in blocks"
                    :key="block.entryId"
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
                                >{{ fmtVolume(exVolume(item.ex)) }} kg</span
                            >
                        </div>
                        <div
                            v-for="(set, si) in item.ex.sets"
                            :key="si"
                            class="logline"
                        >
                            <span class="set-lab">{{ si + 1 }}</span>
                            <span class="logline-load">
                                {{ weightLabel(set.weight) }}
                                <span class="x">×</span>
                                {{ set.reps ?? '?' }}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </template>

        <WorkoutActions
            foot
            v-model:editing="editing"
            :completed="completed"
            :saving="saving"
            :resume-blocked="resumeBlocked"
            @finish="finish"
            @resume="resumeOpen = true"
        />

        <!-- Add exercise -->
        <UiModal
            v-model:open="addOpen"
            title="Add exercise"
            description="Add an extra exercise to this workout."
        >
            <ExerciseCombobox
                v-model="addExerciseId"
                :exercises="exercises ?? []"
                placeholder="Pick an exercise"
                creatable
                @created="onExerciseCreated"
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

        <!-- Add superset -->
        <UiModal
            v-model:open="supersetOpen"
            title="Add superset"
            description="Pick two or more exercises to rotate through back to back."
        >
            <div class="space-y-2">
                <ExerciseCombobox
                    v-for="(_, i) in supersetIds"
                    :key="i"
                    v-model="supersetIds[i]"
                    :exercises="exercises ?? []"
                    placeholder="Pick an exercise"
                    creatable
                    @created="onExerciseCreated"
                />
                <button
                    type="button"
                    class="btn-link"
                    @click="supersetIds.push(undefined)"
                >
                    <Icon
                        name="tabler:plus"
                        :size="14"
                    />
                    Add another exercise
                </button>
            </div>
            <template #footer>
                <button
                    type="button"
                    class="btn-ghost"
                    @click="supersetOpen = false"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-primary"
                    :disabled="supersetPicked.length < 2"
                    @click="confirmAddSuperset"
                >
                    <Icon
                        name="tabler:plus"
                        :size="16"
                    />
                    Add
                </button>
            </template>
        </UiModal>

        <!-- Add exercise to a block, making or growing a superset -->
        <UiModal
            :open="addToTarget != null"
            title="Add to superset"
            :description="
                (addToEntry?.exercises.length ?? 0) > 1 ?
                    'Add another exercise to this superset.'
                :   `Pair another exercise with ${addToEntry?.exercises[0]?.name ?? 'this one'} to make a superset.`
            "
            @update:open="(open) => !open && (addToTarget = undefined)"
        >
            <ExerciseCombobox
                v-model="addToExerciseId"
                :exercises="exercises ?? []"
                placeholder="Pick an exercise"
                creatable
                @created="onExerciseCreated"
            />
            <template #footer>
                <button
                    type="button"
                    class="btn-ghost"
                    @click="addToTarget = undefined"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-primary"
                    :disabled="!addToExerciseId"
                    @click="confirmAddTo"
                >
                    <Icon
                        name="tabler:plus"
                        :size="16"
                    />
                    Add
                </button>
            </template>
        </UiModal>

        <!-- Swap exercise -->
        <UiModal
            :open="swapTarget != null"
            title="Swap exercise"
            :description="`Replace ${swapSource?.name ?? 'this exercise'} with another one. Its logged sets are kept.`"
            @update:open="(open) => !open && (swapTarget = undefined)"
        >
            <ExerciseCombobox
                v-model="swapExerciseId"
                :exercises="exercises ?? []"
                placeholder="Pick an exercise"
                creatable
                @created="onExerciseCreated"
            />
            <template #footer>
                <button
                    type="button"
                    class="btn-ghost"
                    @click="swapTarget = undefined"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-primary"
                    :disabled="
                        !swapExerciseId
                        || swapExerciseId === swapSource?.exerciseId
                    "
                    @click="confirmSwap"
                >
                    <Icon
                        name="tabler:switch-horizontal"
                        :size="16"
                    />
                    Swap
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

        <!-- What differs from the template -->
        <UiModal
            v-model:open="diffOpen"
            :title="`Differs from ${template?.name ?? 'session'}`"
            description="How this workout differs from the session."
        >
            <ul class="wk-diff">
                <li
                    v-for="(row, i) in diffItems"
                    :key="i"
                    class="wk-diff-row"
                    :class="`wk-diff-row--${row.tone}`"
                >
                    <span class="wk-diff-sign mono">{{ row.sign }}</span>
                    <span>{{ row.text }}</span>
                </li>
            </ul>
            <p
                v-if="hasRepDiff"
                class="wk-diff-note"
            >
                Reps shown are this workout's. Updating the session keeps its
                prescribed reps and syncs the structure only.
            </p>
            <template #footer>
                <button
                    type="button"
                    class="btn-ghost"
                    @click="diffOpen = false"
                >
                    Close
                </button>
            </template>
        </UiModal>

        <!-- Update template -->
        <UiModal
            v-model:open="updateOpen"
            title="Update session"
            :description="`Make ${template?.name} match this workout? Sets it already prescribes keep their reps; only the structure changes.`"
        >
            <template #footer>
                <button
                    type="button"
                    class="btn-ghost"
                    @click="updateOpen = false"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-primary"
                    :disabled="saving"
                    @click="syncToSession('update')"
                >
                    <Icon
                        name="tabler:check"
                        :size="16"
                    />
                    Update
                </button>
            </template>
        </UiModal>

        <!-- Save as new session -->
        <UiModal
            v-model:open="createOpen"
            title="Save as session"
            :description="
                template ?
                    `Create a new session from this workout — ${template.name} stays unchanged.`
                :   'Create a new session from this workout.'
            "
        >
            <input
                v-model="createName"
                class="input"
                placeholder="Session name"
                aria-label="Session name"
            />
            <template #footer>
                <button
                    type="button"
                    class="btn-ghost"
                    @click="createOpen = false"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-primary"
                    :disabled="saving || !createName.trim()"
                    @click="syncToSession('create')"
                >
                    <Icon
                        name="tabler:plus"
                        :size="16"
                    />
                    Create
                </button>
            </template>
        </UiModal>

        <!-- Resume training -->
        <UiModal
            v-model:open="resumeOpen"
            title="Resume workout"
            description="This marks the workout in progress again and makes it your active workout. Editing the sets here doesn't need this."
        >
            <template #footer>
                <button
                    type="button"
                    class="btn-ghost"
                    @click="resumeOpen = false"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    class="btn-primary"
                    :disabled="saving"
                    @click="resume"
                >
                    <Icon
                        name="tabler:player-play-filled"
                        :size="16"
                    />
                    Resume training
                </button>
            </template>
        </UiModal>
    </div>
</template>
