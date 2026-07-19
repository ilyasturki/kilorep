<script setup lang="ts">
import type { Exercise, SessionWithEntries } from '~~/server/database/schema'
import type {
    SessionEntryDraft as EntryDraft,
    SessionExerciseDraft as ExerciseDraft,
    SessionDraft,
} from '~/utils/sessionDraft'
import { moveItemTo } from '~/utils/moveItemTo'
import {
    emptySessionDraft,
    newSessionEntry,
    newSessionExercise,
    newSessionSet,
    sessionDraftFromSession,
} from '~/utils/sessionDraft'

const [{ data: sessions, status, refresh }, { data: exercises }] =
    await Promise.all([
        useFetch<SessionWithEntries[]>(PAYLOAD.sessions, {
            key: PAYLOAD.sessions,
            server: false,
            lazy: true,
            default: () => [],
            getCachedData: cachedPayload,
        }),
        useFetch<Exercise[]>(PAYLOAD.exercises, {
            key: PAYLOAD.exercises,
            server: false,
            lazy: true,
            default: () => [],
            getCachedData: cachedPayload,
        }),
    ])
revalidate({ status, refresh })
const loading = initialLoading({ status })
const invalidate = usePayloadCache()

// Adopt an inline-created exercise into the local catalog so the builder's
// picker can resolve its label and keep it selected without a refetch.
function onExerciseCreated(exercise: Exercise) {
    exercises.value = [...(exercises.value ?? []), exercise]
}

const draft = ref<SessionDraft>(emptySessionDraft())
const builderOpen = ref(false)
const editingId = ref<number | null>(null)
const saving = ref(false)
const toast = useToast()

// Display density, remembered per device (web-only, never sent to the server).
const view = useLocalStorage<'detailed' | 'condensed'>(
    'sessions-view',
    'detailed',
)

function openBuilder() {
    editingId.value = null
    draft.value = emptySessionDraft()
    builderOpen.value = true
}

function editSession(session: SessionWithEntries) {
    editingId.value = session.id
    draft.value = sessionDraftFromSession(session)
    builderOpen.value = true
}

function closeBuilder() {
    builderOpen.value = false
    editingId.value = null
}

function addExercise() {
    draft.value.entries.push(newSessionEntry())
}
function addSuperset() {
    draft.value.entries.push(newSessionEntry(2))
}
function removeEntry(index: number) {
    draft.value.entries.splice(index, 1)
}
function addExerciseToEntry(entry: EntryDraft) {
    entry.exercises.push(newSessionExercise())
}
function removeExerciseFromEntry(entry: EntryDraft, index: number) {
    entry.exercises.splice(index, 1)
}
function addSet(exercise: ExerciseDraft) {
    exercise.sets.push(newSessionSet())
}
function removeSet(exercise: ExerciseDraft, index: number) {
    exercise.sets.splice(index, 1)
}

async function save() {
    saving.value = true
    try {
        if (editingId.value !== null) {
            await $fetch(`/api/sessions/${editingId.value}`, {
                method: 'PUT',
                body: draft.value,
            })
        } else {
            await $fetch('/api/sessions', {
                method: 'POST',
                body: draft.value,
            })
        }
        closeBuilder()
        await refresh()
        toast.add({ title: 'Session saved', color: 'success' })
    } catch (error: unknown) {
        toast.add({
            title: errorMessage(error, 'Could not save the session'),
            color: 'error',
        })
    } finally {
        saving.value = false
    }
}

const reordering = ref(false)

// The reorder endpoint takes the full id list (a permutation), so the arrows and
// the drag handle persist the same way: mutate the local order, then send it. On
// failure we refetch the authoritative order rather than guess at a rollback.
async function persistOrder() {
    const list = sessions.value
    if (!list) return
    reordering.value = true
    try {
        await $fetch('/api/sessions/reorder', {
            method: 'PATCH',
            body: { ids: list.map((s) => s.id) },
        })
        // The new order is applied optimistically and never refetched on
        // success, so the cached payload would replay the old one.
        invalidate(PAYLOAD.sessions)
    } catch (error: unknown) {
        await refresh()
        toast.add({
            title: errorMessage(error, 'Could not reorder the sessions'),
            color: 'error',
        })
    } finally {
        reordering.value = false
    }
}

// Arrows nudge by one and stay the keyboard/screen-reader path; the drag handle
// produces an arbitrary from→to move. Both feed persistOrder.
async function moveSession(index: number, dir: -1 | 1) {
    if (!sessions.value || !moveItem(sessions.value, index, dir)) return
    await persistOrder()
}

const { dragIndex, isDragging, noTransition, onHandlePointerDown, rowStyle } =
    usePointerReorder({
        count: () => sessions.value?.length ?? 0,
        disabled: () => reordering.value,
        onCommit: (from, to) => {
            if (!sessions.value) return
            sessions.value = moveItemTo(sessions.value, from, to)
            void persistOrder()
        },
    })

const deleteTarget = ref<SessionWithEntries | null>(null)
const deleting = ref(false)

async function confirmDelete() {
    if (!deleteTarget.value) return
    deleting.value = true
    try {
        await $fetch(`/api/sessions/${deleteTarget.value.id}`, {
            method: 'DELETE',
        })
        if (editingId.value === deleteTarget.value.id) closeBuilder()
        deleteTarget.value = null
        await refresh()
        toast.add({ title: 'Session deleted', color: 'success' })
    } catch (error: unknown) {
        toast.add({
            title: errorMessage(error, 'Could not delete the session'),
            color: 'error',
        })
    } finally {
        deleting.value = false
    }
}

const exerciseName = (id: number) =>
    exercises.value?.find((e) => e.id === id)?.name ?? `#${id}`

// One-line content summary for the condensed view.
const countLabel = (session: SessionWithEntries) => {
    const { exercises: ex, sets } = workoutStats(session.entries)
    return `${plural(ex, 'exercise')} · ${plural(sets, 'set')}`
}

const exerciseMuscles = computed(() => musclesByExercise(exercises.value ?? []))
const sessionMuscles = computed(
    () =>
        new Map(
            (sessions.value ?? []).map((s) => [
                s.id,
                topMuscles(s.entries, exerciseMuscles.value),
            ]),
        ),
)

// "3 × 8" when every set shares a rep target, "3 sets" when no set has one,
// otherwise each set's reps with "?" for open targets.
const setSummary = (sets: { reps: number | null }[]) => {
    if (sets.length === 0) return ''
    const reps = sets.map((s) => s.reps)
    if (reps.every((r) => r == null)) {
        return plural(sets.length, 'set')
    }
    if (reps.every((r) => r === reps[0])) {
        return `${sets.length} × ${reps[0]}`
    }
    return reps.map((r) => r ?? '?').join(', ')
}

// Flatten a session into display blocks, numbering exercises 01..N across the
// whole session (superset members included) like the design's plan readout.
function planBlocks(session: SessionWithEntries) {
    let n = 0
    return session.entries.map((entry) => ({
        key: entry.id,
        isSuperset: entry.exercises.length > 1,
        exercises: entry.exercises.map((se) => ({
            key: se.id,
            n: ++n,
            exerciseId: se.exerciseId,
            name: exerciseName(se.exerciseId),
            summary: setSummary(se.sets),
        })),
    }))
}
</script>

<template>
    <div>
        <div class="mb-5 flex items-center gap-4">
            <UiSegmented v-if="sessions?.length">
                <UiSegmentedOption
                    type="button"
                    :active="view === 'detailed'"
                    @click="view = 'detailed'"
                >
                    Detailed
                </UiSegmentedOption>
                <UiSegmentedOption
                    type="button"
                    :active="view === 'condensed'"
                    @click="view = 'condensed'"
                >
                    Condensed
                </UiSegmentedOption>
            </UiSegmented>
            <UiButton
                type="button"
                class="ml-auto"
                @click="openBuilder"
            >
                <Icon
                    name="tabler:plus"
                    :size="16"
                />
                New session
            </UiButton>
        </div>

        <!-- Builder -->
        <UiModal
            :open="builderOpen"
            :title="editingId ? 'Edit session' : 'New session'"
            @update:open="(open) => !open && closeBuilder()"
        >
            <div class="space-y-4">
                <div class="field">
                    <label class="field-label">
                        Name <span class="req">*</span>
                    </label>
                    <input
                        v-model="draft.name"
                        class="input"
                        placeholder="Push Day"
                    />
                </div>

                <TransitionGroup
                    name="reorder"
                    tag="div"
                    class="space-y-3"
                >
                    <div
                        v-for="(entry, entryIndex) in draft.entries"
                        :key="entry.id"
                        class="builder-block"
                        :class="{
                            'builder-block--ss': entry.exercises.length > 1,
                        }"
                    >
                        <div
                            v-if="entry.exercises.length > 1"
                            class="mb-3 flex items-center justify-between"
                        >
                            <span class="tag">Superset</span>
                            <div class="flex items-center gap-1">
                                <MoveButtons
                                    label="block"
                                    :can-up="entryIndex > 0"
                                    :can-down="
                                        entryIndex < draft.entries.length - 1
                                    "
                                    @move="
                                        (dir) =>
                                            moveItem(
                                                draft.entries,
                                                entryIndex,
                                                dir,
                                            )
                                    "
                                />
                                <UiIconButton
                                    type="button"
                                    size="sm"
                                    tone="danger"
                                    aria-label="Remove block"
                                    @click="removeEntry(entryIndex)"
                                >
                                    <Icon
                                        name="tabler:trash"
                                        :size="15"
                                    />
                                </UiIconButton>
                            </div>
                        </div>

                        <div class="space-y-4">
                            <div
                                v-for="(exercise, exIndex) in entry.exercises"
                                :key="exIndex"
                                class="space-y-2"
                            >
                                <div class="flex items-center gap-2">
                                    <div class="min-w-0 flex-1">
                                        <ExerciseCombobox
                                            v-model="exercise.exerciseId"
                                            :exercises="exercises ?? []"
                                            placeholder="Pick an exercise"
                                            creatable
                                            @created="onExerciseCreated"
                                        />
                                    </div>
                                    <UiIconButton
                                        v-if="entry.exercises.length > 1"
                                        type="button"
                                        aria-label="Remove exercise"
                                        @click="
                                            removeExerciseFromEntry(
                                                entry,
                                                exIndex,
                                            )
                                        "
                                    >
                                        <Icon
                                            name="tabler:x"
                                            :size="16"
                                        />
                                    </UiIconButton>
                                    <div
                                        v-else
                                        class="flex items-center gap-1"
                                    >
                                        <MoveButtons
                                            label="block"
                                            :can-up="entryIndex > 0"
                                            :can-down="
                                                entryIndex
                                                < draft.entries.length - 1
                                            "
                                            @move="
                                                (dir) =>
                                                    moveItem(
                                                        draft.entries,
                                                        entryIndex,
                                                        dir,
                                                    )
                                            "
                                        />
                                        <UiIconButton
                                            type="button"
                                            size="sm"
                                            tone="danger"
                                            aria-label="Remove block"
                                            @click="removeEntry(entryIndex)"
                                        >
                                            <Icon
                                                name="tabler:trash"
                                                :size="15"
                                            />
                                        </UiIconButton>
                                    </div>
                                </div>

                                <div class="space-y-2 pl-1">
                                    <div
                                        v-for="(set, setIndex) in exercise.sets"
                                        :key="setIndex"
                                        class="set-row"
                                    >
                                        <span class="set-lab">
                                            SET {{ setIndex + 1 }}
                                        </span>
                                        <UiNumberField
                                            v-model="set.reps"
                                            :min="1"
                                        />
                                        <span class="set-lab">reps</span>
                                        <UiIconButton
                                            v-if="exercise.sets.length > 1"
                                            type="button"
                                            size="sm"
                                            aria-label="Remove set"
                                            @click="
                                                removeSet(exercise, setIndex)
                                            "
                                        >
                                            <Icon
                                                name="tabler:minus"
                                                :size="15"
                                            />
                                        </UiIconButton>
                                    </div>
                                    <UiButton
                                        type="button"
                                        tone="link"
                                        @click="addSet(exercise)"
                                    >
                                        <Icon
                                            name="tabler:plus"
                                            :size="14"
                                        />
                                        Add set
                                    </UiButton>
                                </div>
                            </div>
                        </div>

                        <UiButton
                            type="button"
                            tone="link"
                            class="mt-3"
                            @click="addExerciseToEntry(entry)"
                        >
                            <Icon
                                name="tabler:link"
                                :size="14"
                            />
                            Add exercise to superset
                        </UiButton>
                    </div>
                </TransitionGroup>

                <div class="flex flex-wrap gap-2">
                    <UiButton
                        type="button"
                        tone="ghost"
                        size="sm"
                        @click="addExercise"
                    >
                        <Icon
                            name="tabler:plus"
                            :size="15"
                        />
                        Add exercise
                    </UiButton>
                    <UiButton
                        type="button"
                        tone="ghost"
                        size="sm"
                        @click="addSuperset"
                    >
                        <Icon
                            name="tabler:stack-2"
                            :size="15"
                        />
                        Add superset
                    </UiButton>
                </div>
            </div>

            <template #footer>
                <UiButton
                    type="button"
                    tone="ghost"
                    @click="closeBuilder"
                >
                    Cancel
                </UiButton>
                <UiButton
                    type="button"
                    :disabled="saving"
                    @click="save"
                >
                    <Icon
                        name="tabler:check"
                        :size="16"
                    />
                    {{
                        saving ? 'Saving…'
                        : editingId ? 'Save changes'
                        : 'Save session'
                    }}
                </UiButton>
            </template>
        </UiModal>

        <!-- List -->
        <UiEmpty v-if="loading"> Loading… </UiEmpty>
        <UiEmpty v-else-if="!sessions?.length">
            No sessions yet. Create your first routine.
        </UiEmpty>
        <TransitionGroup
            v-else
            name="reorder"
            tag="div"
            :class="[
                view === 'condensed' ? 'space-y-2' : 'space-y-4',
                { 'is-reordering': isDragging, 'reorder-frozen': noTransition },
            ]"
        >
            <div
                v-for="(session, sessionIndex) in sessions"
                :key="session.id"
                data-reorder-row
                class="reorder-slot"
                :class="{ 'reorder-lift': dragIndex === sessionIndex }"
            >
                <!-- The drag transform lives on this inner row, never on the slot
                     above: TransitionGroup's FLIP only watches its own child (the
                     slot), so keeping the slot still stops it from writing a
                     competing transform and flinging the lifted row off-screen. -->
                <div
                    :class="[
                        view === 'condensed' ? 'session-row' : (
                            'border border-line-2 bg-surface p-6'
                        ),
                        { 'reorder-dragging': dragIndex === sessionIndex },
                    ]"
                    :style="
                        view === 'condensed' ?
                            rowStyle(sessionIndex)
                        :   undefined
                    "
                >
                    <!-- Condensed: one line per session -->
                    <template v-if="view === 'condensed'">
                        <span
                            v-if="(sessions?.length ?? 0) > 1"
                            class="drag-handle"
                            :class="{ 'is-locked': reordering }"
                            aria-hidden="true"
                            @pointerdown="
                                (e) => onHandlePointerDown(e, sessionIndex)
                            "
                        >
                            <Icon
                                name="tabler:grip-vertical"
                                :size="16"
                            />
                        </span>
                        <div class="flex min-w-0 flex-1 items-center gap-2.5">
                            <h3 class="session-name min-w-0">
                                <button
                                    type="button"
                                    class="session-name-btn max-w-full truncate"
                                    @click="editSession(session)"
                                >
                                    {{ session.name }}
                                </button>
                            </h3>
                            <span class="session-meta">
                                {{ countLabel(session) }}
                            </span>
                        </div>
                        <div class="flex shrink-0 items-center gap-1">
                            <MoveButtons
                                label="session"
                                :can-up="sessionIndex > 0 && !reordering"
                                :can-down="
                                    sessionIndex < (sessions?.length ?? 0) - 1
                                    && !reordering
                                "
                                @move="(dir) => moveSession(sessionIndex, dir)"
                            />
                            <UiIconButton
                                type="button"
                                size="sm"
                                aria-label="Edit session"
                                @click="editSession(session)"
                            >
                                <Icon
                                    name="tabler:pencil"
                                    :size="15"
                                />
                            </UiIconButton>
                            <UiIconButton
                                type="button"
                                size="sm"
                                tone="danger"
                                aria-label="Delete session"
                                @click="deleteTarget = session"
                            >
                                <Icon
                                    name="tabler:trash"
                                    :size="15"
                                />
                            </UiIconButton>
                        </div>
                    </template>

                    <template v-else>
                        <UiCardHead>
                            <div class="flex min-w-0 items-center gap-2.5">
                                <h3 class="session-name min-w-0">
                                    <button
                                        type="button"
                                        class="session-name-btn max-w-full truncate"
                                        @click="editSession(session)"
                                    >
                                        {{ session.name }}
                                    </button>
                                </h3>
                                <span class="tag">
                                    {{
                                        plural(
                                            workoutStats(session.entries).sets,
                                            'set',
                                        )
                                    }}
                                </span>
                            </div>
                            <div class="flex items-center gap-1">
                                <MoveButtons
                                    label="session"
                                    :can-up="sessionIndex > 0 && !reordering"
                                    :can-down="
                                        sessionIndex
                                            < (sessions?.length ?? 0) - 1
                                        && !reordering
                                    "
                                    @move="
                                        (dir) => moveSession(sessionIndex, dir)
                                    "
                                />
                                <UiIconButton
                                    type="button"
                                    size="sm"
                                    aria-label="Edit session"
                                    @click="editSession(session)"
                                >
                                    <Icon
                                        name="tabler:pencil"
                                        :size="15"
                                    />
                                </UiIconButton>
                                <UiIconButton
                                    type="button"
                                    size="sm"
                                    tone="danger"
                                    aria-label="Delete session"
                                    @click="deleteTarget = session"
                                >
                                    <Icon
                                        name="tabler:trash"
                                        :size="15"
                                    />
                                </UiIconButton>
                            </div>
                        </UiCardHead>

                        <TopMuscles
                            :muscles="sessionMuscles.get(session.id) ?? []"
                            class="mt-3"
                        />

                        <div class="plan-list">
                            <div
                                v-for="block in planBlocks(session)"
                                :key="block.key"
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
                                    <span class="plan-ex-idx">
                                        {{ String(ex.n).padStart(2, '0') }}
                                    </span>
                                    <span class="plan-ex-name">{{
                                        ex.name
                                    }}</span>
                                    <span class="plan-ex-target">{{
                                        ex.summary
                                    }}</span>
                                </NuxtLink>
                            </div>
                        </div>
                    </template>
                </div>
            </div>
        </TransitionGroup>

        <!-- Delete session -->
        <UiModal
            :open="deleteTarget !== null"
            title="Delete session"
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
